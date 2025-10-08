import { NextRequest, NextResponse } from 'next/server';

import { getCreationBySlug } from '@/lib/gallery/repository';
import { buildPublicAssetUrl, createSignedAssetUrl } from '@/lib/gallery/storage';

export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const creation = await getCreationBySlug(params.slug);
    if (!creation || creation.status !== 'published') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const glbUrl = creation.modelGlbPath
      ? await createSignedAssetUrl(creation.modelGlbPath, { scope: 'private', expiresIn: 60 * 30 }).catch(
          () => null,
        )
      : null;
    const usdzUrl = creation.modelUsdzPath
      ? await createSignedAssetUrl(creation.modelUsdzPath, { scope: 'private', expiresIn: 60 * 30 }).catch(
          () => null,
        )
      : null;

    return NextResponse.json({
      id: creation.id,
      slug: creation.slug,
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
      publishedAt: creation.publishedAt,
      assets: {
        thumbnail: creation.thumbnailPath ? buildPublicAssetUrl(creation.thumbnailPath) : null,
        composite: creation.compositePath ? buildPublicAssetUrl(creation.compositePath) : null,
        model: {
          glb: glbUrl,
          usdz: usdzUrl,
        },
      },
    });
  } catch (error) {
    console.error('[gallery-public-detail]', error);
    return NextResponse.json({ error: 'Failed to load creation' }, { status: 500 });
  }
}
