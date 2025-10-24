"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { notFound, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { Button, InstructionBanner, ScreenBackground } from "@/components/ui";
import { detectDeviceType } from "@/lib/device";
import { AR_SUMMON_KEY, GENERATION_RESULTS_KEY } from "@/lib/storage-keys";
import { FallbackViewer } from "@/components/fallback-viewer";
import { logDebug, logError, logWarn } from "@/lib/logger";

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
    logDebug("[ar-session] init", {
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
        logWarn("[ar-session] generation results missing");
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
          logDebug("[ar-session] model url loaded", {
            url,
            urls
          });
        } else {
          setModelUrl(null);
          setViewerError(t("session.viewerMissing"));
          logWarn("[ar-session] model url missing", {
            model
          });
        }
      }
    } catch (error) {
      logError("Failed to read generation results", error);
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
            <p className="text-xs text-textSecondary/70">
              {isJa
                ? '準備が整いました。下のボタンからエモカイを呼び出せます。'
                : 'All set. Use the button below to bring your Emokai here.'}
            </p>
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
  }, [currentMode, device, isJa, launchUrl, modelUrl, t, viewerError, viewerLoading]);

  const handleQuickLook = useCallback(() => {
    if (!launchUrl) return;
    setLaunchAttempted(true);
    if (quickLookAnchorRef.current) {
      quickLookAnchorRef.current.click();
    } else {
      window.location.href = launchUrl;
    }
  }, [launchUrl]);

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
      logWarn("[ar-session] failed to parse model for AR", error);
      return { launch: null, urls: null };
    }
  }, []);

  useEffect(() => {
    if (currentMode !== "ar") return;
    const { launch, urls } = readLaunchUrl();
    setLaunchUrl(launch);
    if (!launch) {
      setViewerError(t("session.viewerMissing"));
      logWarn("[ar-session] launch url missing", { urls });
    } else {
      setViewerError(null);
      logDebug("[ar-session] launch url ready", { launch, urls });
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

  useEffect(() => {
    if (currentMode !== "ar" || !isIOS) return;
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (!launchAttempted) return;
      router.push(`/${locale}/emokai/step/15`);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [currentMode, isIOS, launchAttempted, locale, router]);

  return (
    <ScreenBackground>
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-8 sm:px-8">
        <div className="flex-1 space-y-8">
          <InstructionBanner tone={viewerError ? "error" : "default"}>{bannerMessage}</InstructionBanner>
          {viewerContent}
        <div className="space-y-3 pt-2">
          {currentMode === "ar" ? (
            <Button
              type="button"
              className="w-full"
              onClick={handleQuickLook}
              disabled={!launchUrl}
            >
              {launchUrl
                ? t("session.openQuickLook")
                : isJa
                  ? 'エモカイを呼び出す準備をしています…'
                  : 'Preparing your Emokai…'}
            </Button>
          ) : (
            <Button
              type="button"
              className="w-full"
              onClick={() => router.replace(`/${locale}/ar/session?mode=ar`)}
            >
              {isJa ? 'ARモードに戻る' : 'Return to AR mode'}
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => router.push(`/${locale}/emokai/step/15`)}
          >
            {isJa ? '送り出しの画面へ進む' : 'Continue to send-off'}
          </Button>
        </div>
        <a
          ref={quickLookAnchorRef}
          rel="ar"
          href={launchUrl ?? undefined}
          className="hidden"
          aria-hidden="true"
        >
          Quick Look
        </a>
      </div>
      </main>
    </ScreenBackground>
  );
}
