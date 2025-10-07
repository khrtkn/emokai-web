"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { notFound, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { Button, Header, InstructionBanner } from "@/components/ui";
import { detectDeviceType } from "@/lib/device";
import { AR_SUMMON_KEY, GENERATION_RESULTS_KEY } from "@/lib/storage-keys";
import { FallbackViewer } from "@/components/fallback-viewer";

type StoredModel = {
  url?: string | null;
  alternates?: {
    usdz?: string | null;
    glb?: string | null;
  } | null;
};

function extractModelUrls(model: StoredModel | undefined | null) {
  const primary = typeof model?.url === "string" ? model.url : null;
  const alternates = model?.alternates ?? {};
  const alternateUsd = typeof alternates?.usdz === "string" ? alternates.usdz : null;
  const alternateGlb = typeof alternates?.glb === "string" ? alternates.glb : null;

  const hasExtension = (url: string | null, ext: string) =>
    typeof url === "string" ? url.toLowerCase().includes(`.${ext.toLowerCase()}`) : false;

  const primaryIsUsdz = hasExtension(primary, "usdz");
  const primaryIsGlb = hasExtension(primary, "glb");

  const usdz = primaryIsUsdz ? primary : alternateUsd;
  const glb = primaryIsGlb ? primary : alternateGlb;

  return {
    primary,
    usdz: usdz ?? null,
    glb: glb ?? null
  };
}

type ARSessionPageProps = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default function ARSessionPage({ searchParams }: ARSessionPageProps) {
  const modeParam = searchParams?.mode;
  const mode = Array.isArray(modeParam) ? modeParam[0] : modeParam;
  const currentMode = mode === "fallback" ? "fallback" : mode === "ar" ? "ar" : "ar";

  if (modeParam && currentMode !== modeParam && modeParam !== "ar" && modeParam !== "fallback") {
    notFound();
  }

  const t = useTranslations("ar");
  const locale = useLocale();
  const router = useRouter();
  const isJa = locale === "ja";
  const device = detectDeviceType();
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [viewerLoading, setViewerLoading] = useState<boolean>(currentMode === "fallback");
  const [launchUrl, setLaunchUrl] = useState<string | null>(null);
  const [launchAttempted, setLaunchAttempted] = useState(false);
  const isIOS = device === "ios";
  const quickLookAnchorRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    console.log("[ar-session] init", {
      mode: currentMode,
      device,
      isIOS
    });
  }, [currentMode, device, isIOS]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(AR_SUMMON_KEY, "true");
    }
  }, []);

  useEffect(() => {
    if (currentMode !== "fallback") return;
    setViewerLoading(true);
    try {
      const raw = sessionStorage.getItem(GENERATION_RESULTS_KEY);
      if (!raw) {
        setViewerError(t("session.viewerMissing"));
        setModelUrl(null);
        console.warn("[ar-session] generation results missing");
      } else {
        const parsed = JSON.parse(raw) as {
          results?: {
            model?: StoredModel;
          };
        };
        const model = parsed?.results?.model;
        const urls = extractModelUrls(model);
        const url = urls.glb ?? urls.primary ?? null;

        if (url) {
          setModelUrl(url);
          setViewerError(null);
          console.log("[ar-session] model url loaded", {
            url,
            urls
          });
        } else {
          setModelUrl(null);
          setViewerError(t("session.viewerMissing"));
          console.warn("[ar-session] model url missing", {
            model
          });
        }
      }
    } catch (error) {
      console.error("Failed to read generation results", error);
      setViewerError(t("session.viewerMissing"));
      setModelUrl(null);
    } finally {
      setViewerLoading(false);
    }
  }, [currentMode, t]);

  const viewerContent = useMemo(() => {
    if (currentMode !== "fallback") {
      return (
        <div className="rounded-3xl border border-divider bg-[rgba(255,255,255,0.05)] p-6 text-sm text-textSecondary space-y-3">
          <p>{t("session.arPlaceholder", { device: t(`device.${device}`) })}</p>
          {launchUrl ? (
            <>
              <button
                type="button"
                onClick={() => {
                  if (quickLookAnchorRef.current) {
                    quickLookAnchorRef.current.click();
                  } else {
                    window.location.href = launchUrl;
                  }
                }}
                className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-black"
              >
                {t("session.openQuickLook")}
              </button>
              <a ref={quickLookAnchorRef} rel="ar" href={launchUrl} className="hidden" aria-hidden="true">
                Quick Look
              </a>
            </>
          ) : null}
        </div>
      );
    }

    if (viewerError) {
      return (
        <div className="flex h-[360px] w-full items-center justify-center rounded-3xl border border-divider bg-[rgba(255,255,255,0.05)] p-6 text-sm text-[#ffb9b9]">
          {viewerError}
        </div>
      );
    }

    if (!modelUrl || viewerLoading) {
      return (
        <div className="flex h-[360px] w-full items-center justify-center rounded-3xl border border-divider bg-[rgba(255,255,255,0.05)] p-6 text-sm text-textSecondary">
          {t("session.viewerPlaceholder")}
        </div>
      );
    }

    return (
      <FallbackViewer
        modelUrl={modelUrl}
        loadingLabel={t("session.viewerPlaceholder")}
        errorLabel={t("session.viewerFailed")}
      />
    );
  }, [currentMode, device, launchUrl, modelUrl, t, viewerError, viewerLoading]);

  const bannerMessage = viewerError
    ? viewerError
    : currentMode === "ar"
    ? t("session.instructions")
    : t("session.fallbackInstructions");

  const readLaunchUrl = useCallback(() => {
    if (typeof window === "undefined") {
      return { launch: null, urls: null as ReturnType<typeof extractModelUrls> | null };
    }
    const raw = sessionStorage.getItem(GENERATION_RESULTS_KEY);
    if (!raw) {
      return { launch: null, urls: null };
    }
    try {
      const parsed = JSON.parse(raw) as {
        results?: {
          model?: StoredModel;
        };
      };
      const model = parsed?.results?.model;
      const urls = extractModelUrls(model);
      const preferred = urls.usdz ?? urls.primary ?? null;
      return { launch: preferred, urls };
    } catch (error) {
      console.warn("[ar-session] failed to parse model for AR", error);
      return { launch: null, urls: null };
    }
  }, []);

  useEffect(() => {
    if (currentMode !== "ar") return;
    const { launch, urls } = readLaunchUrl();
    setLaunchUrl(launch);
    if (!launch) {
      setViewerError(t("session.viewerMissing"));
      console.warn("[ar-session] launch url missing", { urls });
    } else {
      setViewerError(null);
      console.log("[ar-session] launch url ready", { launch, urls });
    }
  }, [currentMode, readLaunchUrl, t]);

  useEffect(() => {
    if (currentMode !== "ar" || !launchUrl || launchAttempted || !isIOS) return;
    setLaunchAttempted(true);
    if (quickLookAnchorRef.current) {
      quickLookAnchorRef.current.click();
    } else {
      window.location.href = launchUrl;
    }
  }, [currentMode, isIOS, launchUrl, launchAttempted]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-canvas">
      <Header
        title="EMOKAI"
        hideTitle
        leading={
          <Image
            src="/Logo.png"
            alt="Emokai"
            width={132}
            height={100}
            className="h-full w-auto"
            priority
          />
        }
      />
      <div className="flex-1 space-y-6 px-4 py-6 sm:px-6">
        <InstructionBanner tone={viewerError ? "error" : "default"}>{bannerMessage}</InstructionBanner>
        {viewerContent}
        <div className="space-y-3 pt-2">
          <Button
            type="button"
            className="w-full"
            onClick={() => router.push(`/${locale}/emokai/step/14`)}
          >
            {isJa ? '送り出しの画面へ進む' : 'Continue to send-off'}
          </Button>
          <button
            type="button"
            className="w-full rounded-lg border border-divider px-4 py-2 text-sm text-textSecondary transition hover:border-accent"
            onClick={() => router.push(`/${locale}/ar`)}
          >
            {isJa ? '呼び出し画面に戻る' : 'Back to AR launcher'}
          </button>
        </div>
      </div>
    </main>
  );
}
