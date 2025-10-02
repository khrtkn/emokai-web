export type CachedImage = {
  base64: string;
  mimeType: string;
  objectUrl?: string;
};

type ImageCacheMap = Map<string, CachedImage>;

const GLOBAL_KEY = "__emokaiImageCache__" as const;

declare global {
  interface Window {
    [GLOBAL_KEY]?: ImageCacheMap;
  }
}

function ensureCache(): ImageCacheMap | null {
  if (typeof window === "undefined") return null;
  if (!window[GLOBAL_KEY]) {
    window[GLOBAL_KEY] = new Map<string, CachedImage>();
  }
  return window[GLOBAL_KEY] ?? null;
}

export function base64ToBlob(base64: string, mimeType: string): Blob {
  if (typeof window !== "undefined" && typeof window.atob === "function") {
    const binary = window.atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
  }

  if (typeof Buffer !== "undefined") {
    const buffer = Buffer.from(base64, "base64");
    return new Blob([buffer], { type: mimeType });
  }

  throw new Error("Unable to convert base64 to Blob in this environment");
}

export function cacheImage(cacheKey: string, base64: string, mimeType: string): string {
  const cache = ensureCache();
  if (!cache) {
    // Server-side / tests fall back to data URI
    return `data:${mimeType};base64,${base64}`;
  }

  const existing = cache.get(cacheKey);
  if (existing?.objectUrl) {
    URL.revokeObjectURL(existing.objectUrl);
  }

  let objectUrl: string | undefined;
  try {
    const blob = base64ToBlob(base64, mimeType);
    objectUrl = URL.createObjectURL(blob);
  } catch (error) {
    console.warn("Failed to create object URL, falling back to data URI", error);
    objectUrl = `data:${mimeType};base64,${base64}`;
  }

  cache.set(cacheKey, { base64, mimeType, objectUrl });
  return objectUrl;
}

export function getCachedImage(cacheKey: string): CachedImage | null {
  const cache = ensureCache();
  if (!cache) return null;
  return cache.get(cacheKey) ?? null;
}

export function releaseCachedImage(cacheKey: string) {
  const cache = ensureCache();
  if (!cache) return;
  const entry = cache.get(cacheKey);
  if (entry?.objectUrl) {
    URL.revokeObjectURL(entry.objectUrl);
  }
  cache.delete(cacheKey);
}

export function clearCachedImages(cacheKeys: Iterable<string>) {
  const cache = ensureCache();
  if (!cache) return;
  for (const key of cacheKeys) {
    const entry = cache.get(key);
    if (entry?.objectUrl) {
      URL.revokeObjectURL(entry.objectUrl);
    }
    cache.delete(key);
  }
}
