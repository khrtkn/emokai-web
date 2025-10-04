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

export function ARLauncher() {
  const t = useTranslations("ar");
  const locale = useLocale();
  const router = useRouter();

  const [deviceType, setDeviceType] = useState<string>("unknown");
  const [support, setSupport] = useState<ARSupport>("unsupported");
  const [permissionState, setPermissionState] = useState<PermissionState>("idle");
  const [viewerMode, setViewerMode] = useState<ViewerMode>("fallback");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const detected = detectDeviceType();
    setDeviceType(detected);
    const capability = checkARCapability();
    setSupport(capability);
    setViewerMode(capability === "supported" ? "ar" : "fallback");
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
    }
  }, [support, t]);

  useEffect(() => {
    const stored = sessionStorage.getItem(CAMERA_PERMISSION_KEY);
    if (stored === "granted") {
      setPermissionState("granted");
    } else if (stored === "denied") {
      setPermissionState("denied");
    }
  }, []);

  const isIOS = deviceType === "ios";

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
    const raw = sessionStorage.getItem(GENERATION_RESULTS_KEY);
    if (!raw) {
      setError(t("missingResults"));
      console.warn("[ar-launcher] launch blocked: missing results");
      return;
    }
    if (viewerMode === "ar" && permissionState !== "granted") {
      setError(t("permissionRequired"));
      console.warn("[ar-launcher] launch blocked: camera permission", { viewerMode, permissionState });
      return;
    }
    console.log("[ar-launcher] launching", {
      viewerMode,
      permissionState
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

  const canLaunch = viewerMode === "ar" ? permissionState === "granted" : true;
  const launchLabel = viewerMode === "ar" ? t("launchAR") : t("openViewer");
  const primaryButtonClass =
    "w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

  const bannerMessage = error ? error : t(`status.${viewerMode}`);

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
