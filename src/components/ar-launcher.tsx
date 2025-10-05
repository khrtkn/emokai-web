"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { detectDeviceType, checkARCapability, ARSupport } from "@/lib/device";
import { GENERATION_RESULTS_KEY } from "@/lib/storage-keys";
import { Divider, Header, InstructionBanner, MessageBlock } from "@/components/ui";
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = sessionStorage.getItem(GENERATION_RESULTS_KEY);
    if (!raw) {
      setModelInfo({ hasModel: false, hasUsdz: false, primaryUrl: null, usdzUrl: null });
      return;
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
        setModelInfo({ hasModel: false, hasUsdz: false, primaryUrl: null, usdzUrl: null });
        return;
      }
      const primaryUrl = model.url ?? null;
      const normalizedPrimary = primaryUrl ? primaryUrl.toLowerCase() : "";
      const usdzAlternate = model.alternates?.usdz ?? null;
      const hasUsdz = Boolean(
        normalizedPrimary.endsWith(".usdz") || (typeof usdzAlternate === "string" && usdzAlternate.toLowerCase().includes(".usdz"))
      );
      const usdzUrl = normalizedPrimary.endsWith(".usdz") ? primaryUrl : usdzAlternate ?? null;
      console.log("[ar-launcher] model info", {
        hasUsdz,
        primaryUrl,
        usdzUrl
      });
      setModelInfo({ hasModel: true, hasUsdz, primaryUrl, usdzUrl });
    } catch (parseError) {
      console.warn("[ar-launcher] failed to parse generation results", parseError);
      setModelInfo({ hasModel: false, hasUsdz: false, primaryUrl: null, usdzUrl: null });
    }
  }, [locale, support, deviceType]);

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
    trackEvent("ar_launch", { action: viewerMode === "ar" ? "launch_ar" : "launch_fallback", locale });
    router.push(`/${locale}/ar/session?mode=${viewerMode}`);
  };

  const handleBackToResult = () => {
    router.push(`/${locale}/result`);
  };

  const handleOpenGallery = () => {
    router.push(`/${locale}/gallery`);
  };

  const canLaunch = viewerMode === "ar"
    ? !pendingUsdz && (requiresCameraPermission ? permissionState === "granted" : true)
    : true;
  const launchLabel = viewerMode === "ar" ? t("launchAR") : t("openViewer");
  const primaryButtonClass =
    "w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

  const bannerMessage = error ? error : pendingUsdz ? t("status.pending") : t(`status.${viewerMode}`);

  return (
    <div className="flex flex-col">
      <Header title={t("title")} />
      <Divider />
      <div className="space-y-6 px-4 py-6 sm:px-6">
        <InstructionBanner tone={error ? "error" : "default"}>
          {bannerMessage}
        </InstructionBanner>
        <MessageBlock
          title={t("deviceTitle")}
          body={
            <div className="space-y-2">
              <p>{t("deviceDetected", { device: t(`device.${deviceType}`) })}</p>
              <p>{t(`support.${support}`)}</p>
            </div>
          }
        />
        {!isIOS && support !== "unsupported" ? (
          <MessageBlock
            title={t("permissionTitle")}
            body={
              <div className="space-y-3">
                <p>{t("permissionDescription")}</p>
                <button
                  type="button"
                  onClick={handleRequestPermission}
                  className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90"
                >
                  {permissionState === "granted" ? t("permissionGranted") : t("requestPermission")}
                </button>
              </div>
            }
          />
        ) : null}
        <MessageBlock
          title={t("viewerTitle")}
          body={
            <div className="space-y-2">
              <p>{t(`viewer.${viewerMode}`)}</p>
              {isIOS && pendingUsdz ? (
                <p className="text-xs text-[#ffb9b9]">{t("status.pending")}</p>
              ) : null}
              {!isIOS ? (
                <button
                  type="button"
                  onClick={() => setViewerMode(viewerMode === "ar" ? "fallback" : "ar")}
                  className="rounded-lg border border-divider px-4 py-2 text-xs text-textSecondary"
                >
                  {viewerMode === "ar" ? t("switchFallback") : t("switchAR")}
                </button>
              ) : null}
              <div className="mt-3 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleBackToResult}
                  className="rounded-lg border border-divider px-4 py-2 text-xs text-textSecondary hover:border-accent"
                >
                  {t("backToResult")}
                </button>
                <button
                  type="button"
                  onClick={handleOpenGallery}
                  className="rounded-lg border border-divider px-4 py-2 text-xs text-textSecondary hover:border-accent"
                >
                  {t("openGallery")}
                </button>
              </div>
            </div>
          }
        />
        <div className="pt-2">
          <button
            type="button"
            onClick={handleLaunch}
            disabled={!canLaunch}
            className={primaryButtonClass}
          >
            {launchLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ARLauncher;
