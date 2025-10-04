"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { Divider, Header, InstructionBanner, MessageBlock, StoryCard, Button } from "@/components/ui";
import ShareSheet from "@/components/share-sheet";
import { GENERATION_RESULTS_KEY } from "@/lib/storage-keys";
import { releaseGenerationLock } from "@/lib/session-lock";
import { checkDailyLimit } from "@/lib/rate-limit";
import { saveCreation } from "@/lib/persistence";
import { trackEvent } from "@/lib/analytics";
import { getCachedImage } from "@/lib/image-cache";
import { detectDeviceType } from "@/lib/device";
import type { CompositeResult, ModelResult, StoryResult } from "@/lib/generation-jobs";

interface GenerationResultsPayload {
  characterId: string;
  description: string;
  results: {
    model?: ModelResult;
    composite?: CompositeResult;
    story?: StoryResult;
  };
  completedAt: number | null;
}

type Step = "story" | "composite" | "ar";

const STEP_SEQUENCE: Step[] = ["story", "composite", "ar"];

export function ResultViewer() {
  const t = useTranslations("result");
  const locale = useLocale();
  const router = useRouter();

  const [results, setResults] = useState<GenerationResultsPayload | null>(null);
  const [step, setStep] = useState<Step>("story");
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error" | "limit">("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [shareDetails, setShareDetails] = useState<{ url: string; expiresAt?: string } | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  const device = useMemo(() => detectDeviceType(), []);
  const isIOS = device === "ios";

  useEffect(() => {
    const raw = sessionStorage.getItem(GENERATION_RESULTS_KEY);
    if (!raw) {
      setError(t("missing"));
      return;
    }
    try {
      const parsed = JSON.parse(raw) as GenerationResultsPayload;
      const composite = parsed?.results?.composite;
      if (composite) {
        const cached = composite.cacheKey ? getCachedImage(composite.cacheKey) : null;
        if (cached) {
          composite.url =
            cached.objectUrl ?? `data:${cached.mimeType};base64,${cached.base64}`;
        } else if (composite.imageBase64 && (!composite.url || !composite.url.startsWith("data:"))) {
          composite.url = `data:${composite.mimeType};base64,${composite.imageBase64}`;
        } else if (
          composite.url &&
          !/^https?:/i.test(composite.url) &&
          !composite.url.startsWith("data:")
        ) {
          composite.url = "";
        }
      }
      setResults(parsed);
    } catch (err) {
      console.error(err);
      setError(t("parseError"));
    }
  }, [t]);

  useEffect(() => {
    return () => {
      releaseGenerationLock();
    };
  }, []);

  const storyContent = results?.results?.story?.content ?? "";
  const compositeUrl = results?.results?.composite?.url ?? "";
  const model = results?.results?.model;
  const modelUrl = model?.url ?? "";

  const hasUsdzModel = useMemo(() => {
    if (!model) return false;
    const primary = model.url?.toLowerCase() ?? "";
    if (primary.endsWith(".usdz")) return true;
    const alternate = model.alternates?.usdz ?? null;
    if (typeof alternate === "string" && alternate.toLowerCase().includes(".usdz")) {
      return true;
    }
    return false;
  }, [model]);

  const arReady = useMemo(() => {
    if (!modelUrl) return false;
    if (!isIOS) return true;
    return hasUsdzModel;
  }, [isIOS, modelUrl, hasUsdzModel]);

  const actionLabel = useMemo(() => {
    if (step === "ar") {
      return t("goToAR");
    }
    return t("next");
  }, [step, t]);

  const actionDisabled = useMemo(() => {
    if (!results) return true;
    if (step === "story") {
      return !storyContent;
    }
    if (step === "composite") {
      return !compositeUrl;
    }
    if (step === "ar") {
      return !modelUrl || !arReady;
    }
    return false;
  }, [step, results, storyContent, compositeUrl, modelUrl, arReady]);

  const saveLabel = useMemo(() => {
    if (saveStatus === "saving") return t("saving");
    if (saveStatus === "saved") return t("saved");
    if (saveStatus === "error") return t("saveError");
    if (saveStatus === "limit") return t("limitReached", { hours: checkDailyLimit().resetInHours });
    return t("saveButton");
  }, [saveStatus, t]);

  const handleAction = () => {
    if (!results) return;
    if (step === "story") {
      if (compositeUrl) {
        setStep("composite");
      } else if (modelUrl) {
        setStep("ar");
      }
      return;
    }
    if (step === "composite") {
      if (modelUrl) {
        setStep("ar");
      }
      return;
    }
    if (step === "ar") {
      if (!modelUrl || (isIOS && !hasUsdzModel)) {
        return;
      }
      trackEvent("ar_launch", { source: "result", locale });
      router.push(`/${locale}/ar`);
    }
  };

  const licenseFooter = t("licenseNotice");

  const handleSave = () => {
    if (shareDetails) {
      setSaveStatus("saved");
      setSaveMessage(t("saved"));
      trackEvent("share_action", { action: "save_cached", locale });
      return;
    }

    const limit = checkDailyLimit();
    if (!limit.allowed) {
      setSaveStatus("limit");
      setSaveMessage(t("limitReached", { hours: limit.resetInHours }));
      return;
    }

    setSaveStatus("saving");
    const result = saveCreation();
    if (result.success) {
      const shareUrl = result.shareUrl ?? "";
      setShareDetails({ url: shareUrl, expiresAt: result.expiresAt });
      setSaveStatus("saved");
      setSaveMessage(t("saved"));
      trackEvent("share_action", { action: "save", locale });
    } else {
      setSaveStatus("error");
      setSaveMessage(t("saveError"));
    }
  };

  const handleShare = () => {
    if (!shareDetails) {
      handleSave();
      if (!shareDetails) {
        return;
      }
    }
    setSaveMessage(t("shareSuccess"));
    setShareOpen(true);
    trackEvent("share_action", { action: "share_sheet", locale });
  };

  const handleOpenGallery = () => {
    router.push(`/${locale}/gallery`);
  };

  const handleCreateNew = () => {
    router.push(`/${locale}/start`);
  };

  return (
    <div className="flex flex-col">
      <Header
        title={t("title")}
        action={{
          type: "button",
          label: actionLabel,
          onClick: handleAction,
          disabled: actionDisabled,
          showArrow: true
        }}
      />
      <Divider />
      <div className="space-y-6 px-4 py-6 sm:px-6">
        <InstructionBanner tone={error ? "error" : "default"}>
          {error ?? t(`step.${step}`)}
        </InstructionBanner>
        {step === "story" && storyContent ? (
          <StoryCard
            numberLabel={`No. ${results?.characterId ?? "--"}`}
            characterName={t("storyTitle")}
            hostName={t("storyHost")}
            story={<p>{storyContent}</p>}
            footer={licenseFooter}
          />
        ) : null}
        {step === "composite" && compositeUrl ? (
          <div className="space-y-4">
            <img
              src={compositeUrl}
              alt={t("compositeAlt")}
              className="w-full rounded-3xl border border-divider object-cover"
            />
            <p className="text-xs text-textSecondary">{licenseFooter}</p>
          </div>
        ) : null}
        {step === "ar" ? (
          <MessageBlock
            title={t("arTitle")}
            body={
              <div className="space-y-3 text-textSecondary">
                <p>{t("arInstruction")}</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>{t("arTip1")}</li>
                  <li>{t("arTip2")}</li>
                  <li>{t("arTip3")}</li>
                </ul>
                {isIOS && !hasUsdzModel ? (
                  <p className="text-xs text-[#ffb9b9]">{t("arPending")}</p>
                ) : null}
              </div>
            }
            footer={licenseFooter}
          />
        ) : null}
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <Button type="button" onClick={handleSave} className="flex-1 justify-center" showArrow={false}>
              {saveLabel}
            </Button>
            <Button type="button" onClick={handleShare} className="flex-1 justify-center" showArrow={false}>
              {t("shareButton")}
            </Button>
          </div>
          <div className="flex gap-3">
            <Button type="button" onClick={handleOpenGallery} className="w-full justify-center" showArrow>
              {t("openGallery")}
            </Button>
            <Button type="button" onClick={handleCreateNew} className="w-full justify-center" showArrow>
              {t("createNew")}
            </Button>
          </div>
          {saveMessage ? <p className="text-xs text-textSecondary">{saveMessage}</p> : null}
        </div>
      </div>
      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        shareUrl={shareDetails?.url ?? ""}
        description={t("shareDescription")}
      />
    </div>
  );
}

export default ResultViewer;
