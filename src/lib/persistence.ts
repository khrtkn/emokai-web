import { createShareUrl } from "@/lib/share";
import { incrementDailyLimit } from "@/lib/rate-limit";
import { scheduleRetention } from "@/lib/lifecycle";
import {
  GENERATION_RESULTS_KEY,
  STAGE_SELECTION_KEY,
  CHARACTER_SELECTION_KEY,
  PLACE_STORAGE_KEY,
  REASON_STORAGE_KEY,
  ACTION_STORAGE_KEY,
  APPEARANCE_STORAGE_KEY,
  EMOTIONS_STORAGE_KEY,
  GEO_COORDS_STORAGE_KEY
} from "@/lib/storage-keys";
import { getCachedImage } from "@/lib/image-cache";
import type { CompositeResult } from "@/lib/generation-jobs";

export type CreationPayload = {
  id: string;
  stageSelection: unknown;
  characterSelection: unknown;
  results: unknown;
  language: string;
  createdAt: string;
  placeName?: string | null;
  reasonText?: string | null;
  actionText?: string | null;
  appearanceText?: string | null;
  emotions?: string[];
  coordinates?: { lat: number; lng: number } | null;
};

export const CREATIONS_KEY = "persisted-creations";

export type SaveResult = {
  success: boolean;
  shareUrl?: string;
  expiresAt?: string;
  error?: string;
  prunedCount?: number;
  compacted?: boolean;
};

export function getPersistedList(): CreationPayload[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(CREATIONS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn("Failed to parse creations", error);
    localStorage.removeItem(CREATIONS_KEY);
    return [];
  }
}

function isQuotaError(error: unknown): error is DOMException {
  if (!(error instanceof DOMException)) return false;
  return (
    error.name === "QuotaExceededError" ||
    error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    error.code === 22 ||
    error.code === 1014
  );
}

function setPersistedList(list: CreationPayload[]) {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify(list);
  try {
    localStorage.setItem(CREATIONS_KEY, payload);
  } catch (error) {
    if (isQuotaError(error)) {
      throw error;
    }
    throw error;
  }
}

function cloneCreation(payload: CreationPayload): CreationPayload {
  if (typeof structuredClone === "function") {
    return structuredClone(payload);
  }
  return JSON.parse(JSON.stringify(payload)) as CreationPayload;
}

function minifyCreationForStorage(payload: CreationPayload): CreationPayload {
  const clone = cloneCreation(payload);

  const stageOption = (clone.stageSelection as Record<string, any> | null)?.selectedOption;
  if (stageOption && typeof stageOption.previewUrl === "string" && stageOption.previewUrl.startsWith("data:")) {
    stageOption.previewUrl = "";
  }

  const characterOption = (clone.characterSelection as Record<string, any> | null)?.selectedOption;
  if (characterOption && typeof characterOption.previewUrl === "string" && characterOption.previewUrl.startsWith("data:")) {
    characterOption.previewUrl = "";
  }

  const resultsRoot = (clone.results as Record<string, any>) ?? {};
  const compositeCandidates = [resultsRoot?.results?.composite, resultsRoot?.composite].filter(Boolean);

  compositeCandidates.forEach((composite: Record<string, any>) => {
    if (typeof composite !== "object" || !composite) return;
    if (typeof composite.imageBase64 === "string") {
      delete composite.imageBase64;
    }
    if (typeof composite.url === "string" && composite.url.startsWith("data:")) {
      if (typeof composite.cacheKey === "string" && composite.cacheKey.length > 0) {
        composite.inlineUrl = composite.url;
      }
      composite.url = "";
    }
  });

  return clone;
}

export function listCreations(): CreationPayload[] {
  return getPersistedList().sort((a, b) => {
    const aDate = new Date(a.createdAt).getTime();
    const bDate = new Date(b.createdAt).getTime();
    return bDate - aDate;
  });
}

function parseStringArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((value): value is string => typeof value === "string");
    }
  } catch (error) {
    console.warn("Failed to parse stored string array", error);
  }
  return [];
}

function parseCoordinates(raw: string | null): { lat: number; lng: number } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { lat?: number; lng?: number } | null;
    if (parsed && typeof parsed.lat === "number" && typeof parsed.lng === "number") {
      return { lat: parsed.lat, lng: parsed.lng };
    }
  } catch (error) {
    console.warn("Failed to parse stored coordinates", error);
  }
  return null;
}

function createCreationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `creation-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function saveCreation(): SaveResult {
  if (typeof window === "undefined") {
    return { success: false, error: "Unavailable in this environment" };
  }
  const stageSelection = sessionStorage.getItem(STAGE_SELECTION_KEY);
  const characterSelection = sessionStorage.getItem(CHARACTER_SELECTION_KEY);
  const results = sessionStorage.getItem(GENERATION_RESULTS_KEY);

  if (!stageSelection || !characterSelection || !results) {
    return { success: false, error: "Missing data" };
  }

  const stageData = JSON.parse(stageSelection);
  const characterData = JSON.parse(characterSelection);
  const resultsData = JSON.parse(results) as {
    results?: {
      composite?: CompositeResult;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };

  const compositeResult = resultsData?.results?.composite;
  if (compositeResult && compositeResult.cacheKey) {
    const cachedComposite = getCachedImage(compositeResult.cacheKey);
    if (cachedComposite) {
      compositeResult.imageBase64 = cachedComposite.base64;
      compositeResult.mimeType = cachedComposite.mimeType;
      compositeResult.url = `data:${cachedComposite.mimeType};base64,${cachedComposite.base64}`;
    }
  }

  const stageCacheKey = stageData?.selectedOption?.cacheKey as string | undefined;
  const characterCacheKey = characterData?.selectedOption?.cacheKey as string | undefined;

  const stageCache = stageCacheKey ? getCachedImage(stageCacheKey) : null;
  const characterCache = characterCacheKey ? getCachedImage(characterCacheKey) : null;

  const stageSelectionNormalized = {
    ...stageData,
    selectedOption: {
      ...stageData?.selectedOption,
      previewUrl:
        stageCache
          ? `data:${stageCache.mimeType};base64,${stageCache.base64}`
          : stageData?.selectedOption?.previewUrl ?? "",
      mimeType: stageCache?.mimeType ?? stageData?.selectedOption?.mimeType ?? "image/png"
    }
  };

  const characterSelectionNormalized = {
    ...characterData,
    selectedOption: {
      ...characterData?.selectedOption,
      previewUrl:
        characterCache
          ? `data:${characterCache.mimeType};base64,${characterCache.base64}`
          : characterData?.selectedOption?.previewUrl ?? "",
      mimeType: characterCache?.mimeType ?? characterData?.selectedOption?.mimeType ?? "image/png"
    }
  };

  const rawPlace = sessionStorage.getItem(PLACE_STORAGE_KEY);
  const placeName = rawPlace && rawPlace.trim().length ? rawPlace.trim() : null;
  const rawReason = sessionStorage.getItem(REASON_STORAGE_KEY);
  const reasonText = rawReason && rawReason.trim().length ? rawReason.trim() : null;
  const rawAction = sessionStorage.getItem(ACTION_STORAGE_KEY);
  const actionText = rawAction && rawAction.trim().length ? rawAction.trim() : null;
  const rawAppearance = sessionStorage.getItem(APPEARANCE_STORAGE_KEY);
  const appearanceText = rawAppearance && rawAppearance.trim().length ? rawAppearance.trim() : null;
  const emotions = parseStringArray(sessionStorage.getItem(EMOTIONS_STORAGE_KEY));
  const coordinates = parseCoordinates(sessionStorage.getItem(GEO_COORDS_STORAGE_KEY));

  const creation: CreationPayload = {
    id: createCreationId(),
    stageSelection: stageSelectionNormalized,
    characterSelection: characterSelectionNormalized,
    results: resultsData,
    language: navigator.language,
    createdAt: new Date().toISOString(),
    placeName,
    reasonText,
    actionText,
    appearanceText,
    emotions: emotions.length ? emotions : undefined,
    coordinates
  };

  const existing = getPersistedList();
  const combined: CreationPayload[] = [...existing, creation];

  let attempt: CreationPayload[] = [...combined];
  let pruned = 0;
  let minimized = false;

  // Attempt to persist, pruning the oldest creations if we exceed quota.
  for (;;) {
    try {
      setPersistedList(attempt);
      break;
    } catch (error) {
      if (!isQuotaError(error)) {
        console.error("Failed to persist creations", error);
        return { success: false, error: "Storage unavailable" };
      }

      if (attempt.length > 1) {
        attempt = attempt.slice(1);
        pruned += 1;
        continue;
      }

      if (!minimized) {
        attempt = [minifyCreationForStorage(attempt[0])];
        minimized = true;
        continue;
      }

      console.warn("Storage quota exceeded while saving creations");
      return { success: false, error: "Storage limit reached" };
    }
  }

  incrementDailyLimit();
  scheduleRetention(CREATIONS_KEY);

  const share = createShareUrl();

  return {
    success: true,
    shareUrl: share.url,
    expiresAt: share.expiresAt,
    prunedCount: pruned || undefined,
    compacted: minimized || undefined
  };
}
