"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { detectDeviceType, checkARCapability, ARSupport } from "@/lib/device";
import { AR_SUMMON_KEY, GENERATION_RESULTS_KEY } from "@/lib/storage-keys";
import { Button, Header, InstructionBanner } from "@/components/ui";
import { trackEvent } from "@/lib/analytics";

const CAMERA_PERMISSION_KEY = "camera-permission";

type PermissionState = "idle" | "granted" | "denied";

type ViewerMode = "ar" | "fallback";

type ModelInfo = {
  hasModel: boolean;
  hasUsdz: boolean;
  primaryUrl: string | null;
  usdzUrl: string | null;
};

export function ARLauncher() {
  const t = useTranslations("ar");
  const locale = useLocale();
  const router = useRouter();

  const [deviceType, setDeviceType] = useState<string>("unknown");
  const [support, setSupport] = useState<ARSupport>("unsupported");
  const [permissionState, setPermissionState] = useState<PermissionState>("idle");
  const [viewerMode, setViewerMode] = useState<ViewerMode>("fallback");
  const [error, setError] = useState<string | null>(null);
  const [modelInfo, setModelInfo] = useState<ModelInfo>({ hasModel: false, hasUsdz: false, primaryUrl: null, usdzUrl: null });
  const [pendingUsdz, setPendingUsdz] = useState(false);

  useEffect(() => {
    const detected = detectDeviceType();
    setDeviceType(detected);
    const capability = checkARCapability();
    setSupport(capability);
    if (detected !== "ios") {
      setViewerMode(capability === "supported" ? "ar" : "fallback");
    }
    console.log("[ar-launcher] init", {
      detected,
      capability
    });
    trackEvent("ar_launch", { source: "launcher_mount", capability, locale, device: detected });
  }, [locale]);

  useEffect(() => {
    if (support === "unsupported") {
      setError(t("support.unsupported"));
      setViewerMode("fallback");
      setPendingUsdz(false);
    }
  }, [support, t]);

  const readModelInfo = useCallback((): ModelInfo => {
    if (typeof window === "undefined") {
      return { hasModel: false, hasUsdz: false, primaryUrl: null, usdzUrl: null };
    }
    const raw = sessionStorage.getItem(GENERATION_RESULTS_KEY);
    if (!raw) {
      return { hasModel: false, hasUsdz: false, primaryUrl: null, usdzUrl: null };
    }

    try {
      const parsed = JSON.parse(raw) as {
        results?: {
          model?: {
            url?: string | null;
            alternates?: {
              usdz?: string | null;
            };
          };
        };
      };
      const model = parsed?.results?.model;
      if (!model) {
        return { hasModel: false, hasUsdz: false, primaryUrl: null, usdzUrl: null };
      }

      const primaryUrl = model.url ?? null;
      const normalizedPrimary = primaryUrl ? primaryUrl.toLowerCase() : "";
      const usdzAlternate = model.alternates?.usdz ?? null;
      const hasUsdz = Boolean(
        normalizedPrimary.includes(".usdz") ||
        (typeof usdzAlternate === "string" && usdzAlternate.toLowerCase().includes(".usdz"))
      );
      const usdzUrl = normalizedPrimary.includes(".usdz") ? primaryUrl : usdzAlternate ?? null;

      return { hasModel: true, hasUsdz, primaryUrl, usdzUrl };
    } catch (parseError) {
      console.warn("[ar-launcher] failed to parse generation results", parseError);
      return { hasModel: false, hasUsdz: false, primaryUrl: null, usdzUrl: null };
    }
  }, []);

  useEffect(() => {
    const info = readModelInfo();
    setModelInfo(info);
    console.log("[ar-launcher] model info", info);

    if (deviceType !== "ios") {
      return undefined;
    }

    if (info.hasUsdz) {
      console.log("[ar-launcher] USDZ ready on initial check");
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      const next = readModelInfo();
      setModelInfo(next);
      console.log("[ar-launcher] polling model info", next);
      if (next.hasUsdz) {
        console.log("[ar-launcher] USDZ detected during polling");
        window.clearInterval(intervalId);
      }
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [deviceType, readModelInfo]);

  useEffect(() => {
    const stored = sessionStorage.getItem(CAMERA_PERMISSION_KEY);
    if (stored === "granted") {
      setPermissionState("granted");
    } else if (stored === "denied") {
      setPermissionState("denied");
    }
  }, []);

  useEffect(() => {
    if (support === "unsupported") {
      setViewerMode("fallback");
      setPendingUsdz(false);
      return;
    }

    if (deviceType === "ios") {
      if (modelInfo.hasUsdz) {
        setViewerMode("ar");
        setPendingUsdz(false);
        setError(null);
      } else if (modelInfo.hasModel) {
        setViewerMode("ar");
        setPendingUsdz(true);
      } else {
        setViewerMode("fallback");
        setPendingUsdz(false);
      }
      return;
    }

    setPendingUsdz(false);
  }, [deviceType, modelInfo, support]);

  const isIOS = deviceType === "ios";
  const requiresCameraPermission = !isIOS;

  const handleRequestPermission = async () => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      setError(t("permissionUnavailable"));
      return;
    }
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });
      sessionStorage.setItem(CAMERA_PERMISSION_KEY, "granted");
      setPermissionState("granted");
      trackEvent("ar_launch", { action: "camera_granted", locale });
    } catch (err) {
      console.error(err);
      sessionStorage.setItem(CAMERA_PERMISSION_KEY, "denied");
      setPermissionState("denied");
      setError(t("permissionDenied"));
      trackEvent("ar_launch", { action: "camera_denied", locale });
    }
  };

  const handleLaunch = () => {
    if (pendingUsdz) {
      setError(t("status.pending"));
      console.warn("[ar-launcher] launch blocked: pending usdz");
      return;
    }

    const raw = sessionStorage.getItem(GENERATION_RESULTS_KEY);
    if (!raw) {
      setError(t("missingResults"));
      console.warn("[ar-launcher] launch blocked: missing results");
      return;
    }
    if (viewerMode === "ar" && requiresCameraPermission && permissionState !== "granted") {
      setError(t("permissionRequired"));
      console.warn("[ar-launcher] launch blocked: camera permission", { viewerMode, permissionState });
      return;
    }
    console.log("[ar-launcher] launching", {
      viewerMode,
      permissionState,
      pendingUsdz,
      usdzReady: modelInfo.hasUsdz
    });
    sessionStorage.setItem(AR_SUMMON_KEY, "true");
    trackEvent("ar_launch", { action: viewerMode === "ar" ? "launch_ar" : "launch_fallback", locale });
    router.push(`/${locale}/ar/session?mode=${viewerMode}`);
  };

  const canLaunch = viewerMode === "ar"
    ? !pendingUsdz && (requiresCameraPermission ? permissionState === "granted" : true)
    : true;
  const launchLabel = viewerMode === "ar" ? t("launchAR") : t("openViewer");

  const statusMessage = error
    ? error
    : pendingUsdz
      ? t("status.pending")
      : t(`status.${viewerMode}`);

  const viewerHint = viewerMode === "ar" ? t("session.instructions") : t("session.fallbackInstructions");

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
        <InstructionBanner tone={error ? "error" : "default"}>{statusMessage}</InstructionBanner>
        {requiresCameraPermission && permissionState !== "granted" ? (
          <Button onClick={handleRequestPermission} className="w-full">
            {t("requestPermission")}
          </Button>
        ) : null}
        <div className="space-y-2 text-sm text-textSecondary">
          <p>{viewerHint}</p>
          {isIOS && pendingUsdz ? (
            <p className="text-xs text-[#ffb9b9]">{t("status.pending")}</p>
          ) : null}
        </div>
        <Button onClick={handleLaunch} disabled={!canLaunch} className="w-full">
          {launchLabel}
        </Button>
      </div>
    </main>
  );
}

export default ARLauncher;
