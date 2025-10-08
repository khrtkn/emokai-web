import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { z } from 'zod';

import { listCreations } from '@/lib/gallery/repository';
import { createSignedAssetUrl, buildPublicAssetUrl } from '@/lib/gallery/storage';
import type { CreationStatus } from '@/lib/supabase/types';
import { getServerEnv } from '@/lib/env';

const querySchema = z.object({
  status: z
    .enum(['pending', 'published', 'rejected', 'archived'] as [CreationStatus, ...CreationStatus[]])
    .optional(),
  cursor: z.string().optional(),
  limit: z
    .string()
    .optional()
    .transform((value) => (value ? Number.parseInt(value, 10) : undefined))
    .pipe(z.number().int().min(1).max(100).optional()),
});

function authorize(request: NextRequest): boolean {
  const { GALLERY_REVIEWER_TOKEN } = getServerEnv();
  const header = request.headers.get('authorization');
  if (!header) return false;
  const match = /^Bearer\s+(.*)$/i.exec(header);
  if (!match) return false;
  return match[1] === GALLERY_REVIEWER_TOKEN;
}

async function buildAssetUrls(creation: Awaited<ReturnType<typeof listCreations>>['items'][number]) {
  const assets: Record<string, string | null> = {
    thumbnail: creation.thumbnailPath ? buildPublicAssetUrl(creation.thumbnailPath) : null,
    stage: null,
    character: null,
    composite: null,
    modelGlb: null,
    modelUsdz: null,
  };

  if (creation.stageImagePath) {
    assets.stage = await createSignedAssetUrl(creation.stageImagePath, {
      scope: 'private',
      expiresIn: 60 * 15,
    }).catch(() => null);
  }

  if (creation.characterImagePath) {
    assets.character = await createSignedAssetUrl(creation.characterImagePath, {
      scope: 'private',
      expiresIn: 60 * 15,
    }).catch(() => null);
  }

  if (creation.compositePath) {
    assets.composite = await createSignedAssetUrl(creation.compositePath, {
      scope: 'private',
      expiresIn: 60 * 15,
    }).catch(() => null);
  }

  if (creation.modelGlbPath) {
    assets.modelGlb = await createSignedAssetUrl(creation.modelGlbPath, {
      scope: 'private',
      expiresIn: 60 * 60,
    }).catch(() => null);
  }

  if (creation.modelUsdzPath) {
    assets.modelUsdz = await createSignedAssetUrl(creation.modelUsdzPath, {
      scope: 'private',
      expiresIn: 60 * 60,
    }).catch(() => null);
  }

  return assets;
}

export async function GET(request: NextRequest) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsedQuery = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsedQuery.success) {
    return NextResponse.json({ error: 'Invalid query', details: parsedQuery.error.issues }, { status: 400 });
  }

  const { status = 'pending', limit = 20, cursor } = parsedQuery.data;

  try {
    const { items, nextCursor } = await listCreations({ status, limit, cursor });

    const responseItems = await Promise.all(
      items.map(async (item) => ({
        id: item.id,
        slug: item.slug,
        locale: item.locale,
        status: item.status,
        characterName: item.characterName,
        story: item.story,
        placeDescription: item.placeDescription,
        reasonDescription: item.reasonDescription,
        actionDescription: item.actionDescription,
        appearanceDescription: item.appearanceDescription,
        stagePrompt: item.stagePrompt,
        characterPrompt: item.characterPrompt,
        compositeInstruction: item.compositeInstruction,
        latitude: item.latitude,
        longitude: item.longitude,
        altitude: item.altitude,
        emotionLevels: item.emotionLevels,
        metadata: item.metadata,
        submittedAt: item.submittedAt,
        publishedAt: item.publishedAt,
        reviewedAt: item.reviewedAt,
        reviewedBy: item.reviewedBy,
        moderationNotes: item.moderationNotes,
        assets: await buildAssetUrls(item),
      })),
    );

    return NextResponse.json({ items: responseItems, nextCursor });
  } catch (error) {
    console.error('[gallery-review-list]', error);
    return NextResponse.json({ error: 'Failed to load creations' }, { status: 500 });
  }
}
