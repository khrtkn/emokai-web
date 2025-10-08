import Image from 'next/image';

import PublicGalleryGrid, { type GalleryCardData } from '@/components/public-gallery-grid';
import { Header } from '@/components/ui';
import { listCreations } from '@/lib/gallery/repository';
import { buildPublicAssetUrl } from '@/lib/gallery/storage';

export const dynamic = 'force-dynamic';

export default async function GalleryPage({ params }: { params: { locale: string } }) {
  const locale = params.locale;
  const { items, nextCursor } = await listCreations({ status: 'published', locale, limit: 18 });

  const cards: GalleryCardData[] = items.map((item) => ({
    slug: item.slug,
    characterName: item.characterName,
    story: item.story,
    thumbnail: item.thumbnailPath ? buildPublicAssetUrl(item.thumbnailPath) : null,
    publishedAt: item.publishedAt,
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
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 pb-12">
        <section className="space-y-3 text-textPrimary">
          <p className="text-xs uppercase tracking-[0.3em] text-textSecondary">Emokai Catalog</p>
          <h1 className="text-3xl font-semibold">
            {locale === 'ja' ? '観測されたエモカイたち' : 'Emokai Observed'}
          </h1>
          <p className="max-w-2xl text-sm text-textSecondary">
            {locale === 'ja'
              ? 'これまでに送り出されたエモカイの記録です。気になるエモカイを選ぶと詳しい記述と AR ビューを開けます。'
              : 'Discover published Emokai sightings. Select a card to read the story and launch the AR view.'}
          </p>
        </section>

        <PublicGalleryGrid locale={locale} initialItems={cards} initialCursor={nextCursor} pageSize={12} />
      </div>
    </main>
  );
}
