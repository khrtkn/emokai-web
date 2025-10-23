"use client";

import { useMemo, useState, type MouseEvent } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

import type { GalleryCardData } from "@/components/public-gallery-grid";

import "mapbox-gl/dist/mapbox-gl.css";

const Map = dynamic(() => import("react-map-gl").then((mod) => mod.default), { ssr: false });
const Marker = dynamic(() => import("react-map-gl").then((mod) => mod.Marker), { ssr: false });

const MAPBOX_STYLE_DARK = "mapbox://styles/mapbox/dark-v11";

type GalleryPublicViewProps = {
  locale: string;
  items: GalleryCardData[];
};

type MapItem = {
  lat: number;
  lng: number;
  data: GalleryCardData;
};

type OverlayProps = {
  item: GalleryCardData;
  locale: string;
  onClose: () => void;
};

export function GalleryPublicView({ locale, items }: GalleryPublicViewProps) {
  const mapToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const mapItems = useMemo<MapItem[]>(
    () =>
      items
        .filter(
          (item) => typeof item.latitude === "number" && typeof item.longitude === "number",
        )
        .map((item) => ({
          lat: item.latitude as number,
          lng: item.longitude as number,
          data: item,
        })),
    [items],
  );

  const [activeItem, setActiveItem] = useState<GalleryCardData | null>(null);

  const initialViewState = useMemo(() => {
    if (mapItems.length) {
      const anchor = mapItems[0];
      return { longitude: anchor.lng, latitude: anchor.lat, zoom: 10, bearing: 0, pitch: 0 };
    }
    return { longitude: 139.767, latitude: 35.681, zoom: 4.5, bearing: 0, pitch: 0 };
  }, [mapItems]);

  const emptyMessage = locale === "ja"
    ? "観測されたエモカイがまだ地図にありません。新しい観測を追加してください。"
    : "No mapped Emokai yet. Observe a new one to add it here.";

  const tokenMissingMessage = locale === "ja"
    ? "NEXT_PUBLIC_MAPBOX_TOKEN が設定されていません。設定後に地図が表示されます。"
    : "NEXT_PUBLIC_MAPBOX_TOKEN is not configured. Add it to enable the map.";

  return (
    <div className="relative h-full w-full">
      {mapToken ? (
        <Map
          mapboxAccessToken={mapToken}
          mapStyle={MAPBOX_STYLE_DARK}
          initialViewState={initialViewState}
          attributionControl={false}
          style={{ width: "100%", height: "100%" }}
        >
          {mapItems.map((item) => (
            <Marker key={item.data.slug} latitude={item.lat} longitude={item.lng} anchor="bottom">
              <button
                type="button"
                onClick={() => setActiveItem(item.data)}
                className="h-16 w-16 -translate-y-2 rounded-full border-2 border-white shadow-lg transition hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {item.data.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.data.thumbnail}
                    alt={item.data.characterName}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center rounded-full bg-[rgba(237,241,241,0.18)] text-xs text-white/80">
                    {locale === "ja" ? "エモカイ" : "Emokai"}
                  </span>
                )}
              </button>
            </Marker>
          ))}
        </Map>
      ) : (
        <div className="flex h-full w-full items-center justify-center px-6 text-sm text-textSecondary">
          {tokenMissingMessage}
        </div>
      )}

      {mapToken && !mapItems.length ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-sm text-textSecondary">
          {emptyMessage}
        </div>
      ) : null}

      <Link
        href={`/${locale}/emokai/step/1`}
        className="fixed bottom-6 right-1/2 z-40 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-accent text-3xl font-semibold text-canvas shadow-lg transition hover:bg-accent/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:right-8 sm:translate-x-0"
      >
        <span className="sr-only">{locale === "ja" ? '新しいエモカイを観測する' : 'Observe a new Emokai'}</span>
        <span aria-hidden>＋</span>
      </Link>

      {activeItem ? (
        <GalleryOverlay item={activeItem} locale={locale} onClose={() => setActiveItem(null)} />
      ) : null}
    </div>
  );
}

export default GalleryPublicView;

function GalleryOverlay({ item, locale, onClose }: OverlayProps) {
  const isJa = locale === "ja";
  const story = item.story ?? null;
  const thumbnail = item.thumbnail ?? item.composite ?? null;

  const handleBackdropClick = () => {
    onClose();
  };

const handlePanelClick = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(5,8,9,0.78)] px-4 py-10 sm:items-center"
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isJa ? `${item.characterName}の詳細` : `Details for ${item.characterName}`}
        className="relative z-10 w-full max-w-md space-y-4 rounded-3xl border border-divider bg-[rgba(10,14,14,0.95)] p-6 text-sm text-textSecondary shadow-2xl"
        onClick={handlePanelClick}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-textSecondary/60">
              {item.publishedAt
                ? new Date(item.publishedAt).toLocaleDateString(isJa ? 'ja-JP' : 'en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })
                : isJa
                  ? '公開日不明'
                  : 'Unknown date'}
            </p>
            <h3 className="text-lg font-semibold text-textPrimary">{item.characterName}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-transparent px-2 py-1 text-lg text-textSecondary transition hover:text-textPrimary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            aria-label={isJa ? '閉じる' : 'Close'}
          >
            ×
          </button>
        </div>

        <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-divider bg-[rgba(237,241,241,0.08)]">
          {thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbnail} alt={item.characterName} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-textSecondary">
              {isJa ? '画像が見つかりませんでした。' : 'Image not available.'}
            </div>
          )}
        </div>

        {story ? (
          <div className="space-y-2 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-textSecondary/60">
              {isJa ? '物語' : 'Story'}
            </p>
            <p className="whitespace-pre-wrap text-textPrimary">{story}</p>
          </div>
        ) : null}

        <Link
          href={`/${locale}/gallery/${item.slug}`}
          className="inline-flex w-full items-center justify-center rounded-full border border-divider px-4 py-2 text-sm text-textPrimary transition hover:border-accent"
        >
          {isJa ? '詳細ページを開く' : 'View full details'}
        </Link>
      </div>
    </div>
  );
}
