"use client";

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

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

export function GalleryPublicView({ locale, items }: GalleryPublicViewProps) {
  const router = useRouter();
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
    <div className="relative flex h-full min-h-full w-full flex-col min-h-0">
      <div className="pointer-events-none absolute left-1/2 top-6 z-40 -translate-x-1/2">
        <Image
          src="/Logo.png"
          alt="Emokai"
          width={124}
          height={60}
          className="h-[60px] w-auto"
          priority
        />
      </div>
      <div className="flex flex-1 min-h-0">
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
                  onClick={() => router.push(`/${locale}/gallery/${item.data.slug}`)}
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
      </div>

      {mapToken && !mapItems.length ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-sm text-textSecondary">
          {emptyMessage}
        </div>
      ) : null}

      <Link
        href={`/${locale}/emokai/step/1`}
        className="fixed bottom-6 left-1/2 z-40 flex min-h-[48px] -translate-x-1/2 items-center rounded-2xl bg-accent px-6 text-sm font-semibold text-black shadow-lg transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {locale === "ja" ? 'エモカイを観測する' : 'Observe Your Emokai'}
      </Link>
    </div>
  );
}

export default GalleryPublicView;
