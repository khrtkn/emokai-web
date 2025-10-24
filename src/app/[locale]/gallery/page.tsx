import GalleryPublicView from '@/components/gallery-public-view';
import { ScreenBackground } from '@/components/ui';
import { listCreations } from '@/lib/gallery/repository';
import { buildPublicAssetUrl } from '@/lib/gallery/storage';
import type { GalleryCardData } from '@/components/public-gallery-grid';

export const dynamic = 'force-dynamic';

export default async function GalleryPage({ params }: { params: { locale: string } }) {
  const locale = params.locale;
  const { items } = await listCreations({ status: 'published', locale, limit: 18 });

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
    <ScreenBackground className="h-screen">
      <main className="relative h-screen w-full px-6 py-8 sm:px-8">
        <GalleryPublicView locale={locale} items={cards} />
      </main>
    </ScreenBackground>
  );
}
