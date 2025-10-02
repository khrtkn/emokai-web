"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import {
  Divider,
  Header,
  ImageOption,
  InstructionBanner,
  MessageBlock,
  ProgressBar,
  RichInput,
  Button
} from "@/components/ui";
import { moderateText } from "@/lib/moderation";
import { CharacterOption, createCharacterOptions } from "@/lib/character-generation";
import {
  acquireGenerationLock,
  isGenerationLocked,
  releaseGenerationLock
} from "@/lib/session-lock";
import {
  generateComposite,
  generateModel,
  generateStory
} from "@/lib/generation-jobs";
import {
  CHARACTER_SELECTION_KEY,
  GENERATION_RESULTS_KEY,
  STAGE_SELECTION_KEY
} from "@/lib/storage-keys";
import type { ProgressStage } from "@/components/ui";
import { trackEvent, trackError } from "@/lib/analytics";
import { isLiveApisEnabled } from "@/lib/env/client";

const MAX_DESCRIPTION = 300;

type FlowStatus = "idle" | "moderating" | "generating" | "ready" | "error";
type JobStatus = "pending" | "active" | "complete" | "error";

type GenerationState = {
  model: JobStatus;
  composite: JobStatus;
  story: JobStatus;
};

const INITIAL_GENERATION_STATE: GenerationState = {
  model: "pending",
  composite: "pending",
  story: "pending"
};

export function CharacterBuilder() {
  const t = useTranslations("character");
  const locale = useLocale() as "ja" | "en";
  const router = useRouter();

  const [description, setDescription] = useState("");
  const [flowStatus, setFlowStatus] = useState<FlowStatus>("idle");
  const [helperText, setHelperText] = useState<string | undefined>(undefined);
  const [moderationError, setModerationError] = useState<string | undefined>(undefined);
  const [options, setOptions] = useState<CharacterOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [generationState, setGenerationState] = useState<GenerationState>(INITIAL_GENERATION_STATE);
  const [progressActive, setProgressActive] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [lockActive, setLockActive] = useState(false);

  useEffect(() => {
    if (isGenerationLocked()) {
      setLockActive(true);
    }
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem(CHARACTER_SELECTION_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.selectedId) {
          setSelectedId(parsed.selectedId);
        }
        if (typeof parsed?.description === "string") {
          setDescription(parsed.description);
        }
      } catch (error) {
        console.warn("Failed to parse character selection", error);
      }
    }
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const selectedOption = options.find((option) => option.id === selectedId);
    if (!selectedOption) return;
    const payload = {
      selectedId,
      description,
      selectedOption: {
        id: selectedOption.id,
        imageBase64: selectedOption.imageBase64,
        mimeType: selectedOption.mimeType,
        previewUrl: selectedOption.previewUrl,
        prompt: selectedOption.prompt
      },
      timestamp: Date.now()
    };
    sessionStorage.setItem(CHARACTER_SELECTION_KEY, JSON.stringify(payload));
  }, [selectedId, description, options]);

  const canGenerate = description.trim().length >= 10 && flowStatus !== "moderating";
  const canStartGeneration = selectedId !== null && flowStatus === "ready" && !progressActive;
  const progressComplete =
    generationState.model === "complete" &&
    generationState.composite === "complete" &&
    generationState.story === "complete";

  const stages: ProgressStage[] = useMemo(
    () => [
      { id: "model", label: t("progressModel"), status: generationState.model },
      { id: "composite", label: t("progressComposite"), status: generationState.composite },
      { id: "story", label: t("progressStory"), status: generationState.story }
    ],
    [generationState, t]
  );

  const handleGenerateOptions = async () => {
    setFlowStatus("moderating");
    setModerationError(undefined);
    setGenerationError(null);
    trackEvent("generation_start", { step: "character_description", locale });
    const result = await moderateText(description, locale);
    if (!result.allowed) {
      setModerationError(result.reason);
      setFlowStatus("idle");
      return;
    }

    setHelperText(t("helperAfterModeration"));
    setFlowStatus("generating");
    try {
      const generated = await createCharacterOptions(description);
      setOptions(generated);
      setFlowStatus("ready");
      trackEvent("generation_complete", { step: "character_options", locale });
    } catch (error) {
      console.error(error);
      setGenerationError(t("generationError"));
      setFlowStatus("error");
      trackError("character_options", error);
    }
  };

  const handleRegenerateOptions = async () => {
    if (flowStatus === "moderating" || description.trim().length < 10) return;
    setFlowStatus("generating");
    setGenerationError(null);
    try {
      const generated = await createCharacterOptions(description);
      setOptions(generated);
      setFlowStatus("ready");
      trackEvent("generation_complete", { step: "character_options_regen", locale });
    } catch (error) {
      console.error(error);
      setGenerationError(t("generationError"));
      setFlowStatus("error");
      trackError("character_options", error);
    }
  };

  const resetGenerationState = () => {
    setGenerationState({ ...INITIAL_GENERATION_STATE });
    setProgressActive(false);
    setGenerationError(null);
  };

  const completeGeneration = (results: unknown) => {
    sessionStorage.setItem(
      GENERATION_RESULTS_KEY,
      JSON.stringify({
        characterId: selectedId,
        description,
        results,
        completedAt: Date.now()
      })
    );
    releaseGenerationLock();
    setLockActive(false);
  };

  const handleStartGeneration = async () => {
    if (!selectedId || progressActive) return;

    if (!acquireGenerationLock()) {
      setLockActive(true);
      setGenerationError(t("lockActive"));
      trackError("generation_lock", new Error("lock active"));
      return;
    }

    setLockActive(true);
    setProgressActive(true);
    setGenerationState({ model: "active", composite: "active", story: "active" });
    trackEvent("generation_start", { step: "jobs", locale });

    const stageSelection = sessionStorage.getItem(STAGE_SELECTION_KEY);
    let stageForComposite: { imageBase64: string; mimeType: string } | null = null;
    if (stageSelection) {
      try {
        const parsed = JSON.parse(stageSelection);
        if (parsed?.selectedOption?.imageBase64 && parsed?.selectedOption?.mimeType) {
          stageForComposite = {
            imageBase64: parsed.selectedOption.imageBase64,
            mimeType: parsed.selectedOption.mimeType
          };
        }
      } catch (error) {
        console.warn("Failed to parse stage selection", error);
      }
    }

    const characterOption = options.find((option) => option.id === selectedId);
    if (!characterOption) {
      setGenerationError(t("generationError"));
      releaseGenerationLock();
      setLockActive(false);
      trackError("character_option_missing", new Error("character option missing"));
      return;
    }

    const liveApis = isLiveApisEnabled();

    if (liveApis && !stageForComposite) {
      setGenerationState({ ...INITIAL_GENERATION_STATE });
      setProgressActive(false);
      setGenerationError(t("generationError"));
      releaseGenerationLock();
      setLockActive(false);
      trackError("stage_missing", new Error("stage selection missing"));
      return;
    }

    const modelPromise = generateModel({
      characterId: selectedId,
      description,
      characterImage: {
        imageBase64: characterOption.imageBase64,
        mimeType: characterOption.mimeType
      }
    })
      .then((model) => {
        setGenerationState((prev) => ({ ...prev, model: "complete" }));
        return model;
      })
      .catch((error) => {
        console.error(error);
        setGenerationState((prev) => ({ ...prev, model: "error" }));
        throw error;
      });

    const compositePromise = generateComposite(stageForComposite, {
      imageBase64: characterOption.imageBase64,
      mimeType: characterOption.mimeType
    })
      .then((composite) => {
        setGenerationState((prev) => ({ ...prev, composite: "complete" }));
        return composite;
      })
      .catch((error) => {
        console.error(error);
        setGenerationState((prev) => ({ ...prev, composite: "error" }));
        throw error;
      });

    const storyPromise = generateStory(description, locale)
      .then((story) => {
        setGenerationState((prev) => ({ ...prev, story: "complete" }));
        return story;
      })
      .catch((error) => {
        console.error(error);
        setGenerationState((prev) => ({ ...prev, story: "error" }));
        throw error;
      });

    try {
      const [model, composite, story] = await Promise.all([modelPromise, compositePromise, storyPromise]);
      completeGeneration({ model, composite, story });
      trackEvent("generation_complete", { step: "jobs", locale });
    } catch (error) {
      setGenerationError(t("generationError"));
      releaseGenerationLock();
      setLockActive(false);
      trackError("jobs", error);
    }
  };

  const handleNext = () => {
    if (!progressComplete) return;
    router.push(`/${locale}/result`);
  };

  useEffect(() => {
    return () => {
      if (!progressComplete) {
        releaseGenerationLock();
      }
    };
  }, [progressComplete]);

  return (
    <div className="flex flex-col">
      <Header
        title={t("title")}
        action={{
          type: "button",
          label: t("next"),
          onClick: handleNext,
          disabled: !progressComplete,
          showArrow: true
        }}
      />
      <Divider />
      <div className="space-y-6 px-4 py-6 sm:px-6">
        <InstructionBanner tone={generationError ? "error" : "default"}>
          {generationError ?? (lockActive && !progressActive ? t("lockActive") : t("instruction"))}
        </InstructionBanner>
        <RichInput
          label={t("descriptionLabel")}
          placeholder={t("descriptionPlaceholder")}
          value={description}
          onChange={(value) => {
            setDescription(value);
            if (flowStatus === "ready") {
              setFlowStatus("idle");
              setOptions([]);
              setSelectedId(null);
              resetGenerationState();
            }
          }}
          maxLength={MAX_DESCRIPTION}
          helperText={helperText}
          error={moderationError}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={handleGenerateOptions} disabled={!canGenerate}>
            {flowStatus === "moderating" ? t("checking") : t("generateButton")}
          </Button>
          <Button type="button" onClick={handleRegenerateOptions} disabled={flowStatus !== "ready"}>
            {t("regenerate")}
          </Button>
        </div>
        {options.length > 0 ? (
          <div className="space-y-4">
            <div className="grid gap-4">
              {options.map((option) => (
                <ImageOption
                  key={option.id}
                  id={option.id}
                  selected={selectedId === option.id}
                  onSelect={(id) => {
                    setSelectedId(id);
                    resetGenerationState();
                  }}
                  label={t("optionLabel")}
                  image={
                    <img
                      src={option.previewUrl}
                      alt={t("optionAlt")}
                      className="h-full w-full object-cover"
                    />
                  }
                />
              ))}
            </div>
            <Button
              type="button"
              onClick={handleStartGeneration}
              disabled={!canStartGeneration}
              className="w-full justify-center"
              showArrow
            >
              {t("startGeneration")}
            </Button>
          </div>
        ) : null}
        {progressActive || progressComplete ? (
          <ProgressBar
            stages={stages}
            footer={progressComplete ? t("progressComplete") : t("progressRunning")}
          />
        ) : null}
      </div>
    </div>
  );
}

export default CharacterBuilder;
