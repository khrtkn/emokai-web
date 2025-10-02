import { createShareUrl } from "@/lib/share";
import { incrementDailyLimit } from "@/lib/rate-limit";
import { scheduleRetention } from "@/lib/lifecycle";
import { GENERATION_RESULTS_KEY, STAGE_SELECTION_KEY, CHARACTER_SELECTION_KEY } from "@/lib/storage-keys";
import { getCachedImage } from "@/lib/image-cache";
import type { CompositeResult } from "@/lib/generation-jobs";

export type CreationPayload = {
  stageSelection: unknown;
  characterSelection: unknown;
  results: unknown;
  language: string;
  createdAt: string;
};

export const CREATIONS_KEY = "persisted-creations";

export type SaveResult = {
  success: boolean;
  shareUrl?: string;
  expiresAt?: string;
  error?: string;
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

function setPersistedList(list: CreationPayload[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CREATIONS_KEY, JSON.stringify(list));
}

export function listCreations(): CreationPayload[] {
  return getPersistedList().sort((a, b) => {
    const aDate = new Date(a.createdAt).getTime();
    const bDate = new Date(b.createdAt).getTime();
    return bDate - aDate;
  });
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

  const creation: CreationPayload = {
    stageSelection: stageSelectionNormalized,
    characterSelection: characterSelectionNormalized,
    results: resultsData,
    language: navigator.language,
    createdAt: new Date().toISOString()
  };

  const list = getPersistedList();
  list.push(creation);
  setPersistedList(list);
  incrementDailyLimit();
  scheduleRetention(CREATIONS_KEY);

  const share = createShareUrl();

  return {
    success: true,
    shareUrl: share.url,
    expiresAt: share.expiresAt
  };
}
