import Image from 'next/image';

import { Header } from '@/components/ui';
import GalleryPublicView from '@/components/gallery-public-view';
import { listCreations } from '@/lib/gallery/repository';
import { buildPublicAssetUrl } from '@/lib/gallery/storage';
import type { GalleryCardData } from '@/components/public-gallery-grid';

export const dynamic = 'force-dynamic';

export default async function GalleryPage({ params }: { params: { locale: string } }) {
  const locale = params.locale;
  const { items, nextCursor } = await listCreations({ status: 'published', locale, limit: 18 });

  const cards: GalleryCardData[] = items.map((item) => ({
    slug: item.slug,
    characterName: item.characterName,
    story: item.story,
    thumbnail: item.thumbnailPath ? buildPublicAssetUrl(item.thumbnailPath) : null,
    composite: item.compositePath ? buildPublicAssetUrl(item.compositePath) : null,
    publishedAt: item.publishedAt,
    latitude: item.latitude,
    longitude: item.longitude
  }));

  return (
    <main className="flex min-h-screen w-full flex-col bg-canvas">
      <Header
        title="EMOKAI"
        hideTitle
        leading={
          <Image
            src="/Logo.png"
            alt="Emokai"
            width={132}
            height={100}
            className="h-full w-auto"
            priority
          />
        }
      />
      <GalleryPublicView locale={locale} items={cards} nextCursor={nextCursor} />
    </main>
  );
}
