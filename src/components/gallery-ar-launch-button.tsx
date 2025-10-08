"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";

import { Button, InstructionBanner } from "@/components/ui";
import { CHARACTER_NAME_KEY, GENERATION_RESULTS_KEY } from "@/lib/storage-keys";

type GalleryDetailResponse = {
  id: string;
  slug: string;
  locale: string;
  characterName: string | null;
  story: string | null;
  actionDescription: string | null;
  assets?: {
    composite?: string | null;
    model?: {
      glb?: string | null;
      usdz?: string | null;
    } | null;
  } | null;
};

type StoredGenerationPayload = {
  characterId: string;
  description: string;
  name: string;
  results: {
    model?: ModelResultPayload;
    composite?: CompositeResultPayload;
    story?: StoryResultPayload;
  };
  completedAt: number | null;
};

type ModelResultPayload = {
  id: string;
  url: string;
  polygons: number | null;
  previewUrl: string | null;
  meta: Record<string, unknown> | null;
  alternates?: {
    glb?: string | null;
    usdz?: string | null;
  } | null;
};

type CompositeResultPayload = {
  id: string;
  url: string;
  mimeType: string;
};

type StoryResultPayload = {
  id: string;
  locale: string;
  content: string;
};

type GalleryArLaunchButtonProps = {
  locale: string;
  slug: string;
  fallbackName: string;
  fallbackStory: string | null;
  fallbackComposite: string | null;
  className?: string;
  labels: {
    launch: string;
    preparing: string;
    error: string;
  };
};

export function GalleryArLaunchButton({
  locale,
  slug,
  fallbackName,
  fallbackStory,
  fallbackComposite,
  className,
  labels
}: GalleryArLaunchButtonProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleLaunch = async () => {
    if (status === "loading") return;
    setStatus("loading");
    setError(null);

    try {
      const response = await fetch(`/api/gallery/public/${encodeURIComponent(slug)}`, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(`Failed to load gallery detail: ${response.status}`);
      }

      const data = (await response.json()) as GalleryDetailResponse;
      const modelGlb = data.assets?.model?.glb ?? null;
      const modelUsdz = data.assets?.model?.usdz ?? null;
      const primaryModel = modelUsdz ?? modelGlb;

      if (!primaryModel) {
        throw new Error("Model URL missing in gallery detail");
      }

      const resolvedName = data.characterName ?? fallbackName;
      const resolvedStory = data.story ?? fallbackStory;
      const resolvedComposite = data.assets?.composite ?? fallbackComposite;

      const payload: StoredGenerationPayload = {
        characterId: data.id ?? slug,
        description: data.actionDescription ?? "",
        name: resolvedName,
        results: {
          model: {
            id: data.slug ?? slug,
            url: primaryModel,
            polygons: null,
            previewUrl: null,
            meta: {
              source: "gallery",
              slug: data.slug ?? slug
            },
            alternates: {
              glb: modelGlb,
              usdz: modelUsdz
            }
          }
        },
        completedAt: Date.now()
      };

      if (resolvedComposite) {
        let mimeType = "image/jpeg";
        if (resolvedComposite.startsWith("data:")) {
          const separator = resolvedComposite.indexOf(";", 5);
          if (separator > 5) {
            mimeType = resolvedComposite.slice(5, separator);
          }
        }
        payload.results.composite = {
          id: `${data.slug ?? slug}-composite`,
          url: resolvedComposite,
          mimeType
        };
      }

      if (resolvedStory) {
        payload.results.story = {
          id: `${data.slug ?? slug}-story`,
          locale: data.locale ?? locale,
          content: resolvedStory
        };
      }

      sessionStorage.setItem(GENERATION_RESULTS_KEY, JSON.stringify(payload));
      sessionStorage.setItem(CHARACTER_NAME_KEY, resolvedName);

      setStatus("idle");
      router.push(`/${locale}/ar`);
    } catch (err) {
      console.error("[gallery-ar-launch] failed", err);
      setStatus("error");
      setError(labels.error);
    }
  };

  const isLoading = status === "loading";

  return (
    <div className={clsx("flex w-full flex-col gap-3", className)}>
      {status === "error" ? (
        <InstructionBanner tone="error">{error}</InstructionBanner>
      ) : null}
      <Button onClick={handleLaunch} disabled={isLoading} className="w-full">
        {isLoading ? labels.preparing : labels.launch}
      </Button>
    </div>
  );
}

export default GalleryArLaunchButton;
