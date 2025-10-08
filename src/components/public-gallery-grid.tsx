"use client";

import { MutableRefObject, useEffect, useMemo, useState } from "react";
import Link from "next/link";

export type GalleryCardData = {
  slug: string;
  characterName: string;
  story: string | null;
  thumbnail: string | null;
  publishedAt: string | null;
  composite?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type PublicGalleryGridProps = {
  locale: string;
  initialItems: GalleryCardData[];
  initialCursor: string | null;
  pageSize?: number;
  cardRefs?: MutableRefObject<Record<string, HTMLAnchorElement | null>>;
  onItemsChange?: (items: GalleryCardData[]) => void;
};

type ApiResponse = {
  items: {
    slug: string;
    characterName: string;
    story: string | null;
    publishedAt: string | null;
    latitude?: number | null;
    longitude?: number | null;
    assets?: {
      thumbnail?: string | null;
      composite?: string | null;
    } | null;
  }[];
  nextCursor: string | null;
};

function formatDate(value: string | null, locale: string) {
  if (!value) return null;
  try {
    return new Date(value).toLocaleDateString(locale === "ja" ? "ja-JP" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  } catch {
    return value;
  }
}

export function PublicGalleryGrid({
  locale,
  initialItems,
  initialCursor,
  pageSize = 12,
  cardRefs,
  onItemsChange
}: PublicGalleryGridProps) {
  const isJa = locale === "ja";
  const [items, setItems] = useState<GalleryCardData[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cardText = useMemo(
    () => ({
      noImage: isJa ? "画像なし" : "No image",
      unknownDate: isJa ? "公開日不明" : "Unknown date",
      viewDetails: isJa ? "詳細を見る" : "View details"
    }),
    [isJa]
  );

  const stateText = useMemo(
    () => ({
      empty: isJa
        ? "まだ公開されたエモカイはありません。最初の観測者になってください！"
        : "No published Emokai yet. Be the first to send one into the world!",
      loadMore: isJa ? "さらに表示" : "Load more",
      loading: isJa ? "読み込み中..." : "Loading...",
      error: isJa ? "読み込みに失敗しました。少し待ってから再試行してください。" : "Failed to load more creations. Please try again in a moment."
    }),
    [isJa]
  );

  const hasItems = items.length > 0;

  useEffect(() => {
    if (onItemsChange) {
      onItemsChange(items);
    }
  }, [items, onItemsChange]);

  const handleLoadMore = async () => {
    if (!cursor || loading) return;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        locale,
        limit: String(pageSize)
      });
      if (cursor) {
        params.set("cursor", cursor);
      }
      const response = await fetch(`/api/gallery/public?${params.toString()}`, {
        cache: "no-store"
      });
      if (!response.ok) {
        throw new Error(`Failed to load gallery page: ${response.status}`);
      }

      const data = (await response.json()) as ApiResponse;
      const mapped = (data.items ?? []).map((item) => ({
        slug: item.slug,
        characterName: item.characterName,
        story: item.story,
        publishedAt: item.publishedAt,
        thumbnail: item.assets?.thumbnail ?? null,
        composite: item.assets?.composite ?? null,
        latitude: item.latitude ?? null,
        longitude: item.longitude ?? null
      }));

      setItems((prev) => {
        const existing = new Set(prev.map((entry) => entry.slug));
        const deduped = mapped.filter((entry) => !existing.has(entry.slug));
        return [...prev, ...deduped];
      });
      setCursor(data.nextCursor ?? null);
    } catch (err) {
      console.error("[gallery-grid] load more failed", err);
      setError(stateText.error);
    } finally {
      setLoading(false);
    }
  };

  if (!hasItems) {
    return (
      <div className="rounded-3xl border border-divider p-10 text-center text-textSecondary">
        {stateText.empty}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((card) => (
          <Link
            key={card.slug}
            href={`/${locale}/gallery/${card.slug}`}
            ref={(node) => {
              if (cardRefs) {
                cardRefs.current[card.slug] = node;
              }
            }}
            className="group flex h-full flex-col overflow-hidden rounded-3xl border border-divider bg-[rgba(237,241,241,0.04)] transition hover:border-accent"
          >
            {card.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={card.thumbnail}
                alt={card.characterName}
                className="h-48 w-full object-cover transition duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-48 w-full items-center justify-center text-xs text-textSecondary">
                {cardText.noImage}
              </div>
            )}
            <div className="flex flex-1 flex-col gap-2 p-4 text-sm text-textSecondary">
              <p className="text-xs uppercase tracking-[0.3em] opacity-60">
                {formatDate(card.publishedAt, locale) ?? cardText.unknownDate}
              </p>
              <h2 className="text-lg font-semibold text-textPrimary">{card.characterName}</h2>
              <p className="line-clamp-3 text-textSecondary">
                {card.story || (isJa ? "物語はまだ記録されていません。" : "Story not recorded yet.")}
              </p>
              <span className="mt-auto text-xs font-semibold text-accent">{cardText.viewDetails}</span>
            </div>
          </Link>
        ))}
      </section>

      {cursor ? (
        <div className="flex flex-col items-center gap-2">
          {error ? <p className="text-xs text-[#ffb9b9]">{error}</p> : null}
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loading}
            className="rounded-lg border border-divider px-5 py-2 text-xs uppercase tracking-[0.2em] text-textSecondary transition hover:border-accent disabled:opacity-60"
          >
            {loading ? stateText.loading : stateText.loadMore}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default PublicGalleryGrid;
