"use client";

import "mapbox-gl/dist/mapbox-gl.css";

import { MutableRefObject, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import dynamic from "next/dynamic";
import type { GalleryCardData } from "@/components/public-gallery-grid";

const Map = dynamic(() => import("react-map-gl"), { ssr: false });
const Marker = dynamic(() => import("react-map-gl").then((mod) => mod.Marker), { ssr: false });

type GalleryMapProps = {
  items: GalleryCardData[];
  cardRefs: React.MutableRefObject<Record<string, HTMLAnchorElement | null>>;
};

const MAPBOX_STYLE_DARK = "mapbox://styles/mapbox/dark-v11";

export function GalleryMap({ items, cardRefs }: GalleryMapProps) {
  const locale = useLocale();
  const accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const [viewport, setViewport] = useState({
    longitude: 139.767, // default Tokyo
    latitude: 35.681,
    zoom: 4
  });

  const markers = useMemo(
    () =>
      items
        .map((item) => {
          if (typeof item.latitude !== "number" || typeof item.longitude !== "number") {
            return null;
          }
          return {
            slug: item.slug,
            name: item.characterName,
            lat: item.latitude,
            lng: item.longitude,
            thumbnail: item.thumbnail || item.composite
          };
        })
        .filter(Boolean) as Array<{
          slug: string;
          name: string;
          lat: number;
          lng: number;
          thumbnail: string | null;
        }>,
    [items]
  );

  if (!markers.length || !accessToken) {
    return null;
  }

  return (
    <div className="relative h-[360px] w-full overflow-hidden rounded-3xl border border-divider">
      <Map
        initialViewState={viewport}
        onMove={(event) => setViewport(event.viewState)}
        mapStyle={MAPBOX_STYLE_DARK}
        mapboxAccessToken={accessToken}
        attributionControl={false}
        style={{ width: "100%", height: "100%" }}
      >
        {markers.map((marker) => (
          <Marker key={marker.slug} latitude={marker.lat} longitude={marker.lng} anchor="bottom">
            <CustomMarker marker={marker} cardRefs={cardRefs} locale={locale} />
          </Marker>
        ))}
      </Map>
    </div>
  );
}

function CustomMarker({
  marker,
  cardRefs,
  locale
}: {
  marker: { slug: string; name: string; lat: number; lng: number; thumbnail: string | null };
  cardRefs: MutableRefObject<Record<string, HTMLAnchorElement | null>>;
  locale: string;
}) {
  const handleClick = () => {
    const target = cardRefs.current[marker.slug];
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.add("ring-2", "ring-accent");
      setTimeout(() => target.classList.remove("ring-2", "ring-accent"), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="h-14 w-14 cursor-pointer rounded-full border-2 border-white shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {marker.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={marker.thumbnail}
          alt={marker.name}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center rounded-full bg-[rgba(237,241,241,0.12)] text-xs text-white">
          {locale === "ja" ? "エモカイ" : "Emokai"}
        </span>
      )}
    </button>
  );
}

export default GalleryMap;
