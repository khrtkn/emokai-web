"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import {
  Divider,
  Header,
  ImageOption,
  InstructionBanner,
  MessageBlock,
  RichInput,
  Button
} from "@/components/ui";
import { trackEvent, trackError } from "@/lib/analytics";
import { moderateText } from "@/lib/moderation";
import { ProcessedImage, processStageReference } from "@/lib/image";
import { createStageOptions } from "@/lib/stage-generation";
import { STAGE_SELECTION_KEY } from "@/lib/storage-keys";
import type { StageOption } from "@/lib/stage-generation";

const MAX_DESCRIPTION = 300;
type GenerationStatus = "idle" | "moderating" | "ready" | "uploading" | "generating" | "error";

export function StageBuilder() {
  const t = useTranslations("stage");
  const locale = useLocale();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [helperText, setHelperText] = useState<string | undefined>(undefined);
  const [moderationError, setModerationError] = useState<string | undefined>(undefined);
  const [processedImage, setProcessedImage] = useState<ProcessedImage | null>(null);
  const [options, setOptions] = useState<StageOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const canSubmitDescription = description.trim().length >= 10 && status !== "moderating";
  const canProceed = selectedId !== null && status === "ready";

  useEffect(() => {
    if (!selectedId) return;

    const selectedOption = options.find((option) => option.id === selectedId);
    if (!selectedOption) return;

    const payload = {
      selectedId,
      selectedOption: {
        id: selectedOption.id,
        imageBase64: selectedOption.imageBase64,
        mimeType: selectedOption.mimeType,
        previewUrl: selectedOption.previewUrl,
        prompt: selectedOption.prompt
      },
      timestamp: Date.now()
    };

    sessionStorage.setItem(STAGE_SELECTION_KEY, JSON.stringify(payload));
  }, [selectedId, options]);

  useEffect(() => {
    const saved = sessionStorage.getItem(STAGE_SELECTION_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.selectedId) {
          setSelectedId(parsed.selectedId);
        }
      } catch (error) {
        console.warn("Failed to parse stage selection", error);
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      if (processedImage) {
        URL.revokeObjectURL(processedImage.webpUrl);
      }
    };
  }, [processedImage]);

  const handleModerate = async () => {
    setStatus("moderating");
    setModerationError(undefined);
    trackEvent("generation_start", { step: "stage", locale });
    const result = await moderateText(description, locale as "ja" | "en");
    if (!result.allowed) {
      setModerationError(result.reason);
      setStatus("idle");
      return;
    }
    setHelperText(t("helperAfterModeration"));
    setStatus("uploading");
  };

  const handleFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus("generating");
    setGenerationError(null);
    setOptions([]);
    setSelectedId(null);

    try {
      const processed = await processStageReference(file);
      setProcessedImage(processed);
      const generated = await createStageOptions(description, processed);
      setOptions(generated);
      setStatus("ready");
      trackEvent("generation_complete", { step: "stage", locale });
    } catch (error) {
      console.error(error);
      setGenerationError(t("generationError"));
      setStatus("error");
      trackError("stage", error);
    }
  };

  const handleRegenerate = async () => {
    if (!processedImage) return;
    setStatus("generating");
    setGenerationError(null);
    try {
      const generated = await createStageOptions(description, processedImage);
      setOptions(generated);
      setStatus("ready");
      trackEvent("generation_complete", { step: "stage", locale, variant: "regenerate" });
    } catch (error) {
      console.error(error);
      setGenerationError(t("generationError"));
      setStatus("error");
      trackError("stage", error);
    }
  };

  const handleNext = () => {
    if (!selectedId) return;
    router.push(`/${locale}/character`);
  };

  const instructionTone = useMemo(() => {
    if (status === "error") return "error";
    return "default";
  }, [status]);

  return (
    <div className="flex flex-col">
      <Header
        title={t("title")}
        action={{
          type: "button",
          label: t("next"),
          onClick: handleNext,
          disabled: !canProceed,
          showArrow: true
        }}
      />
      <Divider />
      <div className="space-y-6 px-4 py-6 sm:px-6">
        <InstructionBanner tone={instructionTone}>
          {generationError ?? t("instruction")}
        </InstructionBanner>
        <RichInput
          label={t("descriptionLabel")}
          placeholder={t("descriptionPlaceholder")}
          value={description}
          onChange={setDescription}
          maxLength={MAX_DESCRIPTION}
          helperText={helperText}
          error={moderationError}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={handleModerate} disabled={!canSubmitDescription}>
            {status === "moderating" ? t("checking") : t("checkButton")}
          </Button>
          <Button
            type="button"
            onClick={handleFileInput}
            disabled={status !== "uploading" && status !== "ready" && status !== "error"}
          >
            {t("uploadReference")}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            capture="environment"
            onChange={handleFileChange}
          />
        </div>
        {status === "generating" ? (
          <MessageBlock title={t("generatingTitle")} body={<p>{t("generatingBody")}</p>} />
        ) : null}
        {options.length > 0 ? (
          <div className="space-y-4">
            <div className="grid gap-4">
              {options.map((option) => (
                <ImageOption
                  key={option.id}
                  id={option.id}
                  selected={selectedId === option.id}
                  onSelect={setSelectedId}
                  label={t("optionLabel")}
                  image={<img src={option.previewUrl} alt="Stage option" className="h-full w-full object-cover" />}
                />
              ))}
            </div>
            <div className="flex items-center justify-between">
              <button
                type="button"
                className="text-sm text-textSecondary underline decoration-textSecondary/40"
                onClick={handleRegenerate}
              >
                {t("regenerate")}
              </button>
              {processedImage ? (
                <span className="text-xs text-textSecondary">
                  {t("imageMetadata", { size: Math.round(processedImage.size / 1024) })}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default StageBuilder;
