import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { listCreations } from '@/lib/gallery/repository';
import { buildPublicAssetUrl, createSignedAssetUrl } from '@/lib/gallery/storage';

const querySchema = z.object({
  locale: z.string().optional(),
  limit: z
    .string()
    .optional()
    .transform((value) => (value ? Number.parseInt(value, 10) : undefined))
    .pipe(z.number().int().min(1).max(48).optional()),
  cursor: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', details: parsed.error.issues }, { status: 400 });
  }

  const { locale, limit = 12, cursor } = parsed.data;

  try {
    const { items, nextCursor } = await listCreations({ status: 'published', locale, limit, cursor });

    const enriched = await Promise.all(
      items.map(async (item) => ({
        id: item.id,
        slug: item.slug,
        locale: item.locale,
        characterName: item.characterName,
        story: item.story,
        placeDescription: item.placeDescription,
        reasonDescription: item.reasonDescription,
        actionDescription: item.actionDescription,
        appearanceDescription: item.appearanceDescription,
        metadata: item.metadata,
        emotionLevels: item.emotionLevels,
        publishedAt: item.publishedAt,
        assets: {
          thumbnail: item.thumbnailPath ? buildPublicAssetUrl(item.thumbnailPath) : null,
          composite: item.compositePath ? buildPublicAssetUrl(item.compositePath) : null,
        },
      })),
    );

    return NextResponse.json({ items: enriched, nextCursor });
  } catch (error) {
    console.error('[gallery-public-list]', error);
    return NextResponse.json({ error: 'Failed to load gallery' }, { status: 500 });
  }
}
