#!/usr/bin/env tsx
import path from 'node:path';
import fs from 'node:fs/promises';
import readline from 'node:readline/promises';
import process from 'node:process';

import { z } from 'zod';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

import type { CreationRow, Database } from '../src/lib/supabase/types';
import { mapCreationRow, type NormalizedCreation } from '../src/lib/gallery/types';

const envPath = process.env.DOTENV_CONFIG_PATH ?? path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

const DEFAULT_INTERVAL_MS = 30_000;
const STATUSES_TO_SYNC: Array<'pending' | 'published'> = ['pending', 'published'];
const FORMATS = ['glb', 'usdz'] as const;
type ModelFormat = (typeof FORMATS)[number];

interface CliOptions {
  dest?: string;
  intervalMs: number;
  backfill: boolean;
  formats: ModelFormat[];
}

interface ResolvedOptions {
  dest: string;
  intervalMs: number;
  backfill: boolean;
  formats: ModelFormat[];
}

interface DownloadResultSummary {
  format: ModelFormat;
  filePath: string;
  size: number;
}

function printHelp() {
  console.log(`Emokai download daemon\n\nUsage: pnpm emokai:sync -- [options]\n\nOptions:\n  --dest <path>        Destination folder for downloads (falls back to EMOKAI_EXPORT_ROOT)\n  --interval <sec>     Polling interval in seconds (default 30)\n  --backfill           Download all existing pending/published items on first run\n  --format <value>     Restrict formats: glb, usdz, or both (repeat flag to select multiple)\n  --help               Show this message\n`);
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    intervalMs: DEFAULT_INTERVAL_MS,
    backfill: false,
    formats: [...FORMATS]
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--') {
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    if (arg.startsWith('--dest=')) {
      options.dest = arg.slice('--dest='.length);
      continue;
    }

    if (arg === '--dest') {
      const next = argv[i + 1];
      if (!next) {
        throw new Error('--dest flag requires a value');
      }
      options.dest = next;
      i += 1;
      continue;
    }

    if (arg === '--interval' || arg.startsWith('--interval=')) {
      const value = arg.includes('=') ? arg.split('=')[1] : argv[i + 1];
      if (!value) {
        throw new Error('--interval flag requires a value');
      }
      const numeric = Number.parseFloat(value);
      if (!Number.isFinite(numeric) || numeric <= 0) {
        throw new Error('--interval must be a positive number (seconds)');
      }
      options.intervalMs = numeric * 1000;
      if (!arg.includes('=')) i += 1;
      continue;
    }

    if (arg === '--backfill') {
      options.backfill = true;
      continue;
    }

    if (arg === '--format' || arg.startsWith('--format=')) {
      const raw = arg.includes('=') ? arg.split('=')[1] : argv[i + 1];
      if (!raw) {
        throw new Error('--format flag requires a value');
      }
      const value = raw.toLowerCase();
      if (!FORMATS.includes(value as ModelFormat)) {
        throw new Error(`Unsupported format "${raw}". Expected one of: ${FORMATS.join(', ')}`);
      }
      if (!options.formats.includes(value as ModelFormat)) {
        options.formats = [...options.formats, value as ModelFormat];
      }
      if (!arg.includes('=')) i += 1;
      continue;
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown flag: ${arg}`);
    }
  }

  // Ensure formats unique and preserve order glb/usdz
  options.formats = FORMATS.filter((format) => options.formats.includes(format));

  return options;
}

async function promptForDestination(): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question('Destination folder (absolute or relative path): ')).trim();
  rl.close();
  if (!answer) {
    throw new Error('Destination path is required to start syncing.');
  }
  return answer;
}

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9-_]/g, '-');
}

interface SyncEnv {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_GALLERY_PRIVATE_BUCKET: string;
}

class EmokaiModelSyncer {
  private client: SupabaseClient<Database>;

  private processed = new Set<string>();

  private lastSubmittedAt: string | null = null;

  private timer: NodeJS.Timeout | null = null;

  private initialBackfillComplete = false;

  constructor(private options: ResolvedOptions, private env: SyncEnv) {
    this.client = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  async start() {
    console.log('[sync] starting with interval %d ms, formats=%s%s', this.options.intervalMs, this.options.formats.join(', '), this.options.backfill ? ' (backfill enabled)' : '');

    if (this.options.backfill) {
      console.log('[sync] backfill enabled – existing pending/published creations will download on first tick.');
    } else {
      try {
        await this.primeCursor();
      } catch (error) {
        console.error('[sync] failed to seed cursor (will retry on first poll)', error);
      }
    }

    await this.tick();
    this.timer = setInterval(() => {
      this.tick().catch((error) => {
        console.error('[sync] tick error', error);
      });
    }, this.options.intervalMs);

    process.on('SIGINT', () => {
      console.log('\n[sync] Stopping...');
      if (this.timer) {
        clearInterval(this.timer);
      }
      process.exit(0);
    });
  }

  private async primeCursor() {
    const latest = await this.fetchLatest();
    if (!latest) {
      console.log('[sync] no existing creations found');
      return;
    }
    this.lastSubmittedAt = latest.submitted_at;
    const siblings = await this.fetchByTimestamp(latest.submitted_at);
    siblings.forEach((row) => this.processed.add(row.id));
    console.log('[sync] seeded cursor at %s (skipping %d existing rows)', latest.submitted_at, siblings.length);
  }

  private async tick() {
    try {
      const rows = await this.fetchSince(this.options.backfill && !this.initialBackfillComplete ? null : this.lastSubmittedAt);
      if (!rows.length) {
        if (this.options.backfill && !this.initialBackfillComplete) {
          console.log('[sync] backfill complete – no creations to download.');
          this.initialBackfillComplete = true;
          this.options.backfill = false;
        }
        return;
      }

      const newRows = this.filterNewRows(rows);
      if (!newRows.length) {
        this.updateCursor(rows);
        return;
      }

      for (const row of newRows) {
        await this.handleCreation(row);
      }

      this.updateCursor(rows);
      if (this.options.backfill) {
        this.initialBackfillComplete = true;
        this.options.backfill = false;
        console.log('[sync] backfill finished – switching to incremental mode.');
      }
    } catch (error) {
      console.error('[sync] Failed to poll Supabase', error);
    }
  }

  private filterNewRows(rows: CreationRow[]): CreationRow[] {
    if (this.options.backfill && !this.initialBackfillComplete) {
      return rows;
    }
    return rows.filter((row) => !this.processed.has(row.id));
  }

  private updateCursor(rows: CreationRow[]) {
    if (!rows.length) return;
    const latest = rows[rows.length - 1];
    this.lastSubmittedAt = latest.submitted_at;
    rows.forEach((row) => this.processed.add(row.id));
  }

  private async handleCreation(row: CreationRow) {
    const creation = mapCreationRow(row);
    const baseName = this.buildBaseFileName(creation);
    const results: DownloadResultSummary[] = [];

    for (const format of this.options.formats) {
      const pathKey = format === 'glb' ? 'modelGlbPath' : 'modelUsdzPath';
      const storagePath = creation[pathKey as 'modelGlbPath' | 'modelUsdzPath'];
      if (!storagePath) {
        continue;
      }

      try {
        const summary = await this.downloadModel(storagePath, format, baseName);
        results.push(summary);
      } catch (error) {
        console.error(`[sync] Failed to download ${format} for ${creation.slug}`, error);
      }
    }

    await this.writeMetadata(creation, baseName, results);

    if (results.length) {
      console.log('[sync] downloaded %s for %s -> %s', results.map((r) => r.format).join(','), creation.slug, this.options.dest);
    } else {
      console.log('[sync] no downloadable models for %s (slug=%s)', creation.id, creation.slug);
    }
  }

  private buildBaseFileName(creation: NormalizedCreation): string {
    const slugSegment = creation.slug ? sanitizeSegment(creation.slug) : `creation-${creation.id.slice(0, 8)}`;
    return `${slugSegment}-${creation.id.slice(0, 8)}`;
  }

  private async downloadModel(
    storagePath: string,
    format: ModelFormat,
    baseName: string
  ): Promise<DownloadResultSummary> {
    const bucket = this.env.SUPABASE_GALLERY_PRIVATE_BUCKET;
    const { data, error } = await this.client.storage.from(bucket).download(storagePath);
    if (error || !data) {
      throw error ?? new Error(`Storage download failed for ${storagePath}`);
    }

    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileName = `${baseName}.${format}`;
    const destination = path.join(this.options.dest, fileName);
    await fs.writeFile(destination, buffer);

    return { format, filePath: destination, size: buffer.byteLength };
  }

  private async writeMetadata(
    creation: NormalizedCreation,
    baseName: string,
    downloads: DownloadResultSummary[]
  ) {
    const payload = {
      id: creation.id,
      slug: creation.slug,
      status: creation.status,
      locale: creation.locale,
      characterName: creation.characterName,
      story: creation.story,
      placeDescription: creation.placeDescription,
      reasonDescription: creation.reasonDescription,
      actionDescription: creation.actionDescription,
      appearanceDescription: creation.appearanceDescription,
      stagePrompt: creation.stagePrompt,
      characterPrompt: creation.characterPrompt,
      compositeInstruction: creation.compositeInstruction,
      latitude: creation.latitude,
      longitude: creation.longitude,
      altitude: creation.altitude,
      emotionLevels: creation.emotionLevels,
      metadata: creation.metadata,
      submittedAt: creation.submittedAt,
      publishedAt: creation.publishedAt,
      assets: downloads.map((dl) => ({ format: dl.format, path: dl.filePath, size: dl.size })),
      downloadedAt: new Date().toISOString()
    };

    await fs.writeFile(
      path.join(this.options.dest, `${baseName}.json`),
      JSON.stringify(payload, null, 2),
      'utf8'
    );
  }

  private async fetchSince(since: string | null): Promise<CreationRow[]> {
    let query = this.client
      .from('creations')
      .select('*')
      .in('status', STATUSES_TO_SYNC)
      .order('submitted_at', { ascending: true })
      .limit(200);

    if (since) {
      query = query.gte('submitted_at', since);
    }

    const { data, error } = await query;
    if (error || !data) {
      throw error ?? new Error('Failed to fetch creations');
    }
    return data as CreationRow[];
  }

  private async fetchLatest(): Promise<CreationRow | null> {
    const { data, error } = await this.client
      .from('creations')
      .select('*')
      .in('status', STATUSES_TO_SYNC)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }
    return (data as CreationRow) ?? null;
  }

  private async fetchByTimestamp(timestamp: string): Promise<CreationRow[]> {
    const { data, error } = await this.client
      .from('creations')
      .select('*')
      .in('status', STATUSES_TO_SYNC)
      .eq('submitted_at', timestamp);

    if (error || !data) {
      throw error ?? new Error('Failed to fetch sibling creations');
    }
    return data as CreationRow[];
  }
}

async function resolveOptions(): Promise<ResolvedOptions> {
  const parsed = parseArgs(process.argv.slice(2));
  const envDest = process.env.EMOKAI_EXPORT_ROOT;
  let dest = parsed.dest ?? envDest;

  if (!dest) {
    dest = await promptForDestination();
  }

  const resolvedDest = path.resolve(process.cwd(), dest);
  await fs.mkdir(resolvedDest, { recursive: true });

  return {
    dest: resolvedDest,
    intervalMs: parsed.intervalMs,
    backfill: parsed.backfill,
    formats: parsed.formats
  };
}

const syncEnvSchema = z.object({
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  SUPABASE_GALLERY_PRIVATE_BUCKET: z
    .string()
    .min(1, 'SUPABASE_GALLERY_PRIVATE_BUCKET is required')
});

function loadSyncEnv(): SyncEnv {
  const parsed = syncEnvSchema.safeParse({
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_GALLERY_PRIVATE_BUCKET: process.env.SUPABASE_GALLERY_PRIVATE_BUCKET
  });

  if (!parsed.success) {
    throw new Error(`Missing required Supabase env vars: ${parsed.error.message}`);
  }

  return parsed.data;
}

async function main() {
  try {
    const options = await resolveOptions();
    const env = loadSyncEnv();
    const syncer = new EmokaiModelSyncer(options, env);
    await syncer.start();
  } catch (error) {
    console.error('[sync] fatal error', error);
    process.exit(1);
  }
}

void main();
