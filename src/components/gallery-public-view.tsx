"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";

import GalleryMap from "@/components/gallery-map";
import PublicGalleryGrid, { type GalleryCardData } from "@/components/public-gallery-grid";
import { Button } from "@/components/ui";

interface GalleryPublicViewProps {
  locale: string;
  items: GalleryCardData[];
  nextCursor: string | null;
}

export function GalleryPublicView({ locale, items, nextCursor }: GalleryPublicViewProps) {
  const cardRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [currentItems, setCurrentItems] = useState(items);

  const mapItems = useMemo(
    () => currentItems.filter((item) => typeof item.latitude === "number" && typeof item.longitude === "number"),
    [currentItems]
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 pb-12">
      {mapItems.length ? <GalleryMap items={mapItems} cardRefs={cardRefs} /> : null}

      <section className="space-y-6 text-textPrimary">
        <p className="text-xs uppercase tracking-[0.3em] text-textSecondary">Emokai Catalog</p>
        <h1 className="text-3xl font-semibold">
          {locale === "ja" ? "観測されたエモカイたち" : "Emokai Observed"}
        </h1>
        <p className="max-w-2xl text-sm text-textSecondary">
          {locale === "ja"
            ? "これまでに送り出されたエモカイの記録です。気になるエモカイを選ぶと詳しい記述と AR ビューを開けます。"
            : "Discover published Emokai sightings. Select a card to read the story and launch the AR view."}
        </p>
        <Link href={`/${locale}/emokai/step/1`} className="inline-flex w-full sm:w-auto">
          <Button className="w-full sm:w-auto">
            {locale === "ja" ? "新しいエモカイを観測する" : "Observe a new Emokai"}
          </Button>
        </Link>
      </section>

      <PublicGalleryGrid
        locale={locale}
        initialItems={items}
        initialCursor={nextCursor}
        pageSize={12}
        cardRefs={cardRefs}
        onItemsChange={setCurrentItems}
      />
    </div>
  );
}

export default GalleryPublicView;
