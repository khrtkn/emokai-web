"use client";

import { useEffect, useMemo, useState } from "react";
import { notFound } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { Divider, Header, InstructionBanner } from "@/components/ui";
import { detectDeviceType } from "@/lib/device";
import { GENERATION_RESULTS_KEY } from "@/lib/storage-keys";
import { FallbackViewer } from "@/components/fallback-viewer";

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
  const device = detectDeviceType();
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [viewerLoading, setViewerLoading] = useState<boolean>(currentMode === "fallback");
  const isIOS = device === "ios";

  useEffect(() => {
    if (currentMode !== "fallback") return;
    setViewerLoading(true);
    try {
      const raw = sessionStorage.getItem(GENERATION_RESULTS_KEY);
      if (!raw) {
        setViewerError(t("session.viewerMissing"));
        setModelUrl(null);
      } else {
        const parsed = JSON.parse(raw) as {
          results?: {
            model?: {
              url?: string | null;
            };
          };
        };
        const url = parsed?.results?.model?.url ?? null;

        if (url) {
          setModelUrl(url);
          setViewerError(null);
        } else {
          setModelUrl(null);
          setViewerError(t("session.viewerMissing"));
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
        <div className="rounded-3xl border border-divider bg-[rgba(255,255,255,0.05)] p-6 text-sm text-textSecondary">
          {t("session.arPlaceholder", { device: t(`device.${device}`) })}
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
  }, [currentMode, device, modelUrl, t, viewerError, viewerLoading]);

  const bannerMessage = viewerError
    ? viewerError
    : currentMode === "ar"
    ? t("session.instructions")
    : t("session.fallbackInstructions");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-canvas">
      <Header
        title={currentMode === "ar" ? t("session.title") : t("session.fallbackTitle")}
        action={{
          type: "link",
          label: t("session.back"),
          href: `/${locale}/result`,
          showArrow: false
        }}
      />
      <Divider />
      <div className="space-y-6 px-4 py-6 sm:px-6">
        <InstructionBanner tone={viewerError ? "error" : "default"}>
          {bannerMessage}
        </InstructionBanner>
        {viewerContent}
      </div>
    </main>
  );
}
