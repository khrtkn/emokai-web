"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

const CREATIONS_KEY = "persisted-creations";

export function HomeGalleryShortcut() {
  const [hasCreations, setHasCreations] = useState(false);
  const pathname = usePathname();
  const locale = useMemo(() => {
    const seg = (pathname || "/").split("/")[1] || "en";
    return seg === "ja" ? "ja" : "en";
  }, [pathname]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CREATIONS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      setHasCreations(Array.isArray(arr) && arr.length > 0);
    } catch {
      setHasCreations(false);
    }
  }, []);

  if (!hasCreations) return null;

  return (
    <Link
      href={`/${locale}/gallery`}
      className="rounded-lg border border-divider px-4 py-3 text-center text-base font-medium text-textPrimary transition hover:border-accent"
    >
      {locale === "ja" ? "ギャラリーを開く" : "Open Gallery"}
    </Link>
  );
}

export default HomeGalleryShortcut;
