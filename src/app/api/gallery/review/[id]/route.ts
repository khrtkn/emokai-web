import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getCreationBySlug, insertCreationAsset, updateCreation } from '@/lib/gallery/repository';
import { copyAssetBetweenBuckets } from '@/lib/gallery/storage';
import { getServerEnv } from '@/lib/env';
import type { CreationStatus } from '@/lib/supabase/types';

const bodySchema = z.object({
  status: z
    .enum(['pending', 'published', 'rejected', 'archived'] as [CreationStatus, ...CreationStatus[]])
    .optional(),
  characterName: z.string().optional(),
  story: z.string().nullable().optional(),
  placeDescription: z.string().nullable().optional(),
  reasonDescription: z.string().nullable().optional(),
  actionDescription: z.string().nullable().optional(),
  appearanceDescription: z.string().nullable().optional(),
  moderationNotes: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  reviewedBy: z.string().uuid().optional(),
});

function authorize(request: NextRequest): boolean {
const { GALLERY_REVIEWER_TOKEN } = getServerEnv();
  const header = request.headers.get('authorization');
  if (!header) return false;
  const match = /^Bearer\s+(.*)$/i.exec(header);
  if (!match) return false;
  return match[1] === GALLERY_REVIEWER_TOKEN;
}

function getExtensionFromPath(path: string, fallback: string): string {
  const dotIndex = path.lastIndexOf('.');
  if (dotIndex !== -1 && dotIndex < path.length - 1) {
    return path.slice(dotIndex + 1).toLowerCase();
  }
  return fallback;
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', details: parsed.error.issues }, { status: 400 });
  }
  const payload = parsed.data;

  try {
    const existing = await getCreationBySlug(params.id);
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const creationId = existing.id;
    const updates: Record<string, unknown> = {};

    if (payload.characterName !== undefined) {
      updates.character_name = payload.characterName;
    }
    if (payload.story !== undefined) {
      updates.story = payload.story ?? null;
    }
    if (payload.placeDescription !== undefined) {
      updates.place_description = payload.placeDescription ?? null;
    }
    if (payload.reasonDescription !== undefined) {
      updates.reason_description = payload.reasonDescription ?? null;
    }
    if (payload.actionDescription !== undefined) {
      updates.action_description = payload.actionDescription ?? null;
    }
    if (payload.appearanceDescription !== undefined) {
      updates.appearance_description = payload.appearanceDescription ?? null;
    }
    if (payload.moderationNotes !== undefined) {
      updates.moderation_notes = payload.moderationNotes ?? null;
    }
    if (payload.metadata !== undefined) {
      updates.metadata = JSON.parse(JSON.stringify(payload.metadata));
    }

    if (payload.status) {
      updates.status = payload.status;
      if (payload.status === 'published') {
        updates.published_at = new Date().toISOString();

        if (existing.compositePath && !existing.compositePath.startsWith('public/')) {
          const extension = getExtensionFromPath(existing.compositePath, 'webp');
          const targetPath = `creations/${creationId}/public/composite.${extension}`;
          const upload = await copyAssetBetweenBuckets({
            sourceScope: 'private',
            sourcePath: existing.compositePath,
            targetScope: 'public',
            targetPath,
            cacheControl: '86400',
          });

          updates.composite_path = upload.path;

          await insertCreationAsset({
            creation_id: creationId,
            kind: 'composite_public',
            storage_path: upload.path,
            mime_type: upload.contentType,
            size_bytes: upload.size,
            checksum: upload.checksum,
          });
        }
      } else {
        updates.published_at = null;
      }
    }

    if (payload.reviewedBy) {
      updates.reviewed_by = payload.reviewedBy;
    }

    if (
      Object.prototype.hasOwnProperty.call(updates, 'moderation_notes') ||
      payload.reviewedBy ||
      payload.status
    ) {
      updates.reviewed_at = new Date().toISOString();
    }

    const creation = await updateCreation(creationId, updates);

    return NextResponse.json({ creation });
  } catch (error) {
    console.error('[gallery-review-update]', error);
    return NextResponse.json({ error: 'Failed to update creation' }, { status: 500 });
  }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const creation = await getCreationBySlug(params.id);
    if (!creation) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ creation });
  } catch (error) {
    console.error('[gallery-review-get]', error);
    return NextResponse.json({ error: 'Failed to load creation' }, { status: 500 });
  }
}
