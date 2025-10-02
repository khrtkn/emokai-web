"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  Button,
  Divider,
  Header,
  ImageOption,
  InstructionBanner,
  MessageBlock,
  ProgressBar,
  RichInput
} from "@/components/ui";
import { moderateText } from "@/lib/moderation";
import { processStageReference, type ProcessedImage } from "@/lib/image";
import { createStageOptions, type StageOption } from "@/lib/stage-generation";
import { createCharacterOptions, type CharacterOption } from "@/lib/character-generation";
import {
  generateComposite,
  generateModel,
  generateStory,
  type CompositeResult,
  type ModelResult,
  type StoryResult
} from "@/lib/generation-jobs";
import { trackEvent, trackError } from "@/lib/analytics";
import {
  CHARACTER_SELECTION_KEY,
  GENERATION_RESULTS_KEY,
  STAGE_SELECTION_KEY
} from "@/lib/storage-keys";
import {
  acquireGenerationLock,
  isGenerationLocked,
  releaseGenerationLock
} from "@/lib/session-lock";
import type { Locale } from "@/lib/i18n/messages";
import { saveCreation, listCreations, type CreationPayload } from "@/lib/persistence";
import { getCachedImage } from "@/lib/image-cache";

const MIN_TEXT_LENGTH = 10;
const TOTAL_STEPS = 15;

const BASIC_EMOTIONS = [
  "Joy",
  "Trust",
  "Fear",
  "Surprise",
  "Sadness",
  "Disgust",
  "Anger",
  "Anticipation"
];

const DETAIL_EMOTIONS = [
  "Ecstasy",
  "Admiration",
  "Terror",
  "Amazement",
  "Grief",
  "Loathing",
  "Rage",
  "Vigilance",
  "Serenity",
  "Acceptance",
  "Apprehension",
  "Distraction",
  "Pensiveness",
  "Boredom",
  "Annoyance",
  "Interest"
];

type StageFlowStatus = "idle" | "moderating" | "uploading" | "generating" | "ready" | "error";
type CharacterFlowStatus = "idle" | "generating" | "ready" | "error";
type JobStatus = "pending" | "active" | "complete" | "error";

type StoredGenerationPayload = {
  characterId: string;
  description: string;
  results: {
    model: ModelResult;
    composite: CompositeResult;
    story: StoryResult;
  };
  completedAt: number;
};

type Props = { params: { locale: string; id: string } };

type StageSelectionPayload = {
  selectedId: string;
  selectedOption: StageOption;
  timestamp: number;
};

type CharacterSelectionPayload = {
  selectedId: string;
  description: string;
  selectedOption: CharacterOption;
  timestamp: number;
};

const StepLabel = ({ text }: { text?: string }) => {
  if (!text) return null;
  return <p className="text-xs text-textSecondary">{text}</p>;
};

const primaryButtonClass =
  "inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90";
const secondaryButtonClass =
  "inline-block rounded-lg border border-divider px-4 py-2 text-sm text-textPrimary transition hover:border-accent";

function formatDate(value: string, locale: Locale) {
  try {
    return new Date(value).toLocaleString(locale === "ja" ? "ja-JP" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  } catch {
    return value;
  }
}

function readStageSelection(): StageSelectionPayload | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(STAGE_SELECTION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StageSelectionPayload;
    if (parsed?.selectedOption?.id) {
      return parsed;
    }
  } catch (error) {
    console.warn("Failed to parse stage selection", error);
  }
  return null;
}

function persistStageSelection(option: StageOption) {
  if (typeof window === "undefined") return;
  const payload: StageSelectionPayload = {
    selectedId: option.id,
    selectedOption: option,
    timestamp: Date.now()
  };
  window.sessionStorage.setItem(STAGE_SELECTION_KEY, JSON.stringify(payload));
}

function readCharacterSelection(): CharacterSelectionPayload | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(CHARACTER_SELECTION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CharacterSelectionPayload;
    if (parsed?.selectedOption?.id) {
      return parsed;
    }
  } catch (error) {
    console.warn("Failed to parse character selection", error);
  }
  return null;
}

function persistCharacterSelection(option: CharacterOption, description: string) {
  if (typeof window === "undefined") return;
  const payload: CharacterSelectionPayload = {
    selectedId: option.id,
    description,
    selectedOption: option,
    timestamp: Date.now()
  };
  window.sessionStorage.setItem(CHARACTER_SELECTION_KEY, JSON.stringify(payload));
}

function readGenerationPayload(): StoredGenerationPayload | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(GENERATION_RESULTS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredGenerationPayload;
    const composite = parsed?.results?.composite as (CompositeResult & { mimeType?: string }) | undefined;
    if (composite?.imageBase64 && (!composite.url || !composite.url.startsWith("data:"))) {
      const mime = composite.mimeType || "image/png";
      composite.url = `data:${mime};base64,${composite.imageBase64}`;
    }
    if (composite && !composite.imageBase64 && composite.url && !/^https?:/i.test(composite.url) && !composite.url.startsWith("data:")) {
      composite.url = "";
    }
    if (parsed?.results?.composite?.url) {
      return parsed;
    }
  } catch (error) {
    console.warn("Failed to parse generation payload", error);
  }
  return null;
}

function persistGenerationPayload(payload: StoredGenerationPayload) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(GENERATION_RESULTS_KEY, JSON.stringify(payload));
}

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

const loadSessionString = (key: string, fallback = "") => {
  if (typeof window === "undefined") return fallback;
  return window.sessionStorage.getItem(key) ?? fallback;
};

const saveSessionString = (key: string, value: string) => {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(key, value);
};

const loadSessionArray = (key: string) => {
  if (typeof window === "undefined") return [] as string[];
  const raw = window.sessionStorage.getItem(key);
  if (!raw) return [] as string[];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [] as string[];
  }
};

const saveSessionArray = (key: string, value: string[]) => {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(key, JSON.stringify(value));
};

const PLACE_STORAGE_KEY = "emokai_place";
const REASON_STORAGE_KEY = "emokai_reason";
const EMOTIONS_STORAGE_KEY = "emokai_emotions";
const ACTION_STORAGE_KEY = "emokai_action";
const APPEARANCE_STORAGE_KEY = "emokai_appearance";

export default function EmokaiStepPage({ params }: Props) {
  const { locale, id } = params;
  const localeKey: Locale = locale === "ja" ? "ja" : "en";
  const isJa = localeKey === "ja";
  const router = useRouter();

  const rawStep = Number(id);
  const step = useMemo(() => {
    if (Number.isNaN(rawStep)) return 1;
    return Math.min(Math.max(rawStep, 1), TOTAL_STEPS);
  }, [rawStep]);

  useEffect(() => {
    if (Number.isNaN(rawStep) || rawStep < 1 || rawStep > TOTAL_STEPS) {
      router.replace(`/${locale}/emokai/step/1`);
    }
  }, [locale, rawStep, router]);

  const initialPlace = useMemo(() => loadSessionString(PLACE_STORAGE_KEY), []);
  const [placeText, setPlaceText] = useState(initialPlace);
  const [placeTouched, setPlaceTouched] = useState(initialPlace.trim().length > 0);
  const placeValid = placeText.trim().length >= MIN_TEXT_LENGTH;

  const initialReason = useMemo(() => loadSessionString(REASON_STORAGE_KEY), []);
  const [reasonText, setReasonText] = useState(initialReason);
  const [reasonTouched, setReasonTouched] = useState(initialReason.trim().length > 0);
  const reasonValid = reasonText.trim().length >= MIN_TEXT_LENGTH;

  const initialAction = useMemo(() => loadSessionString(ACTION_STORAGE_KEY), []);
  const [actionText, setActionText] = useState(initialAction);
  const [actionTouched, setActionTouched] = useState(initialAction.trim().length > 0);
  const actionValid = actionText.trim().length >= MIN_TEXT_LENGTH;

  const initialAppearance = useMemo(() => loadSessionString(APPEARANCE_STORAGE_KEY), []);
  const [appearanceText, setAppearanceText] = useState(initialAppearance);
  const [appearanceTouched, setAppearanceTouched] = useState(initialAppearance.trim().length > 0);
  const appearanceValid = appearanceText.trim().length >= MIN_TEXT_LENGTH;

  const initialEmotions = useMemo(() => loadSessionArray(EMOTIONS_STORAGE_KEY), []);
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>(initialEmotions);
  const [emotionTouched, setEmotionTouched] = useState(initialEmotions.length > 0);
  const emotionValid = selectedEmotions.length > 0;

  const storedStageSelection = useMemo(() => readStageSelection(), []);
  const [stageOptions, setStageOptions] = useState<StageOption[]>(storedStageSelection ? [storedStageSelection.selectedOption] : []);
  const [stageSelection, setStageSelection] = useState<StageOption | null>(storedStageSelection?.selectedOption ?? null);
  const [stageStatus, setStageStatus] = useState<StageFlowStatus>(storedStageSelection ? "ready" : "idle");
  const [stageHelperText, setStageHelperText] = useState<string | null>(null);
  const [stageModerationError, setStageModerationError] = useState<string | null>(null);
  const [stageGenerationError, setStageGenerationError] = useState<string | null>(null);
  const stageFileInputRef = useRef<HTMLInputElement | null>(null);
  const [stageProcessedImage, setStageProcessedImage] = useState<ProcessedImage | null>(null);

  const storedCharacterSelection = useMemo(() => readCharacterSelection(), []);
  const [characterOptions, setCharacterOptions] = useState<CharacterOption[]>(
    storedCharacterSelection ? [storedCharacterSelection.selectedOption] : []
  );
  const [characterSelection, setCharacterSelection] = useState<CharacterOption | null>(
    storedCharacterSelection?.selectedOption ?? null
  );
  const [characterStatus, setCharacterStatus] = useState<CharacterFlowStatus>(
    storedCharacterSelection ? "ready" : "idle"
  );
  const [characterGenerationError, setCharacterGenerationError] = useState<string | null>(null);

  const storedGeneration = useMemo(() => readGenerationPayload(), []);
  const [generationState, setGenerationState] = useState<GenerationState>(storedGeneration ? {
    model: "complete",
    composite: "complete",
    story: "complete"
  } : INITIAL_GENERATION_STATE);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationRunning, setGenerationRunning] = useState(false);
  const [generationLockActive, setGenerationLockActive] = useState(isGenerationLocked());
  const [generationResults, setGenerationResults] = useState<StoredGenerationPayload | null>(storedGeneration);

  const [creations, setCreations] = useState<CreationPayload[]>(() => listCreations());
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [shareDetails, setShareDetails] = useState<{ url: string; expiresAt?: string } | null>(null);

  useEffect(() => {
    if (!stageProcessedImage) return;
    return () => {
      URL.revokeObjectURL(stageProcessedImage.webpUrl);
    };
  }, [stageProcessedImage]);

  useEffect(() => {
    if (step === 15) {
      setCreations(listCreations());
    }
  }, [step]);

  useEffect(() => {
    if (step < 11) {
      setGenerationState(INITIAL_GENERATION_STATE);
      setGenerationError(null);
      setGenerationResults(null);
      setGenerationRunning(false);
    }
  }, [step]);

  const minLengthHint = isJa ? "10文字以上で入力してください" : "Please enter at least 10 characters.";
  const selectOneHint = isJa ? "1つ選択してください。" : "Please select at least one option.";
  const nextLabel = isJa ? "次へ" : "Next";
  const selectNextLabel = isJa ? "選択して次へ" : "Select and Continue";
  const registerLabel = isJa ? "登録する" : "Register";
  const summonLabel = isJa ? "ARで召喚" : "Summon in AR";
  const createAnotherLabel = isJa ? "新しいエモカイを作る" : "Create another Emokai";
  const generatingLabel = isJa ? "生成しています..." : "Generating...";

  const stepLabelText = useMemo(() => {
    if (step >= 2 && step <= 9) {
      const index = step - 1;
      return `Step. ${index}/8`;
    }
    return undefined;
  }, [step]);

  const stagePrompt = useMemo(() => {
    const lines: string[] = [];
    lines.push(
      localeKey === "ja"
        ? `場所の情景: ${placeText}`
        : `Scene description: ${placeText}`
    );
    if (reasonText.trim()) {
      lines.push(
        localeKey === "ja"
          ? `大切な理由: ${reasonText}`
          : `Why it matters: ${reasonText}`
      );
    }
    lines.push(
      localeKey === "ja"
        ? "フォトリアルな背景のみの画像を4枚生成してください。人物は含めないでください。"
        : "Generate four photorealistic background-only images (no people)."
    );
    return lines.join("\n");
  }, [localeKey, placeText, reasonText]);

  const characterPrompt = useMemo(() => {
    const lines: string[] = [];
    lines.push(
      localeKey === "ja"
        ? "以下の情報をもとに、感情の妖怪『エモカイ』の外見アイデアをイメージとして生成してください。"
        : "Generate visual concepts for an Emokai based on the following details."
    );
    lines.push(localeKey === "ja" ? `場所: ${placeText}` : `Place: ${placeText}`);
    lines.push(localeKey === "ja" ? `この場所が大切な理由: ${reasonText}` : `Why it matters: ${reasonText}`);
    if (selectedEmotions.length) {
      lines.push(
        localeKey === "ja"
          ? `抱く感情: ${selectedEmotions.join("、")}`
          : `Emotions: ${selectedEmotions.join(", ")}`
      );
    }
    lines.push(localeKey === "ja" ? `エモカイの行動: ${actionText}` : `Emokai's action: ${actionText}`);
    lines.push(localeKey === "ja" ? `外見の詳細: ${appearanceText}` : `Appearance details: ${appearanceText}`);
    return lines.join("\n");
  }, [localeKey, placeText, reasonText, selectedEmotions, actionText, appearanceText]);

  const storyPrompt = useMemo(() => {
    if (localeKey === "ja") {
      return `あなたは感情の妖怪『エモカイ』の語り部です。以下の情報をもとに、日本語で500文字程度の物語を作成してください。\n\n場所: ${placeText}\n大切な理由: ${reasonText}\n抱く感情: ${selectedEmotions.join("、") || "不明"}\nエモカイの行動: ${actionText}\nエモカイの外見: ${appearanceText}`;
    }
    return `You are the storyteller of an Emokai, a yokai born from emotions. Craft an English narrative (~500 characters) using the details below.\n\nPlace: ${placeText}\nWhy it matters: ${reasonText}\nEmotions: ${selectedEmotions.join(", ") || "Unknown"}\nEmokai action: ${actionText}\nAppearance cues: ${appearanceText}`;
  }, [localeKey, placeText, reasonText, selectedEmotions, actionText, appearanceText]);

  const pillClass = (selected: boolean) =>
    `rounded-full border px-3 py-2 text-xs transition ${
      selected
        ? "border-transparent bg-accent text-black"
        : "border-divider text-textSecondary hover:border-accent"
    }`;

  const handlePlaceChange = (value: string) => {
    setPlaceTouched(true);
    setPlaceText(value);
    saveSessionString(PLACE_STORAGE_KEY, value);
    setStageGenerationError(null);
    setStageHelperText(
      isJa
        ? "テキストを更新したら『テキストから再生成』を押してください"
        : "Press 'Regenerate from text' after editing the description."
    );
  };

  const handleReasonChange = (value: string) => {
    setReasonTouched(true);
    setReasonText(value);
    saveSessionString(REASON_STORAGE_KEY, value);
    setStageGenerationError(null);
    setStageHelperText(
      isJa
        ? "テキストを更新したら『テキストから再生成』を押してください"
        : "Press 'Regenerate from text' after editing the description."
    );
  };

  const handleActionChange = (value: string) => {
    setActionTouched(true);
    setActionText(value);
    saveSessionString(ACTION_STORAGE_KEY, value);
  };

  const handleAppearanceChange = (value: string) => {
    setAppearanceTouched(true);
    setAppearanceText(value);
    saveSessionString(APPEARANCE_STORAGE_KEY, value);
    setCharacterGenerationError(null);
  };

  const toggleEmotion = (emotion: string) => {
    setEmotionTouched(true);
    setSelectedEmotions((prev) => {
      const exists = prev.includes(emotion);
      const nextList = exists ? prev.filter((item) => item !== emotion) : [...prev, emotion];
      saveSessionArray(EMOTIONS_STORAGE_KEY, nextList);
      return nextList;
    });
  };

  const stageDescriptionReady = placeText.trim().length >= MIN_TEXT_LENGTH;

  const runStageGeneration = async ({
    processedImage = null,
    trackLabel,
    autoSelect = false
  }: {
    processedImage?: ProcessedImage | null;
    trackLabel: string;
    autoSelect?: boolean;
  }): Promise<boolean> => {
    setStageStatus("generating");
    setStageHelperText(null);
    setStageModerationError(null);
    setStageGenerationError(null);
    setStageOptions([]);
    setStageSelection(null);
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(STAGE_SELECTION_KEY);
    }

    setStageProcessedImage((previous) => {
      if (previous && previous !== processedImage && processedImage) {
        URL.revokeObjectURL(previous.webpUrl);
      }
      if (!processedImage && previous) {
        URL.revokeObjectURL(previous.webpUrl);
      }
      return processedImage ?? null;
    });

    trackEvent("generation_start", { step: trackLabel, locale });

    try {
      const moderation = await moderateText(stagePrompt, localeKey);
      if (!moderation.allowed) {
        setStageGenerationError(moderation.reason ?? (isJa ? "入力内容に問題があります" : "Content not allowed."));
        setStageStatus("error");
        return false;
      }

      const generated = await createStageOptions(stagePrompt, processedImage ?? null);
      setStageOptions(generated);
      setStageStatus("ready");
      setStageHelperText(isJa ? "生成された候補から背景を選択してください" : "Choose one of the generated backgrounds.");
      if (generated.length && autoSelect) {
        const first = generated[0];
        setStageSelection(first);
        persistStageSelection(first);
      }
      trackEvent("generation_complete", { step: trackLabel, locale });
      return true;
    } catch (error) {
      console.error(error);
      setStageGenerationError(isJa ? "背景の生成に失敗しました" : "Failed to generate stage options.");
      setStageStatus("error");
      trackError(trackLabel, error);
      return false;
    }
  };

  const runCharacterGeneration = async (trackLabel: string): Promise<boolean> => {
    setCharacterStatus("generating");
    setCharacterGenerationError(null);
    setCharacterOptions([]);
    setCharacterSelection(null);
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(CHARACTER_SELECTION_KEY);
    }

    trackEvent("generation_start", { step: trackLabel, locale });

    try {
      const moderation = await moderateText(characterPrompt, localeKey);
      if (!moderation.allowed) {
        setCharacterGenerationError(moderation.reason ?? (isJa ? "入力内容に問題があります" : "Content not allowed."));
        setCharacterStatus("error");
        return false;
      }

      const generated = await createCharacterOptions(characterPrompt);
      setCharacterOptions(generated);
      setCharacterStatus("ready");
      trackEvent("generation_complete", { step: trackLabel, locale });
      return true;
    } catch (error) {
      console.error(error);
      setCharacterGenerationError(isJa ? "キャラクター生成に失敗しました" : "Failed to generate character options.");
      setCharacterStatus("error");
      trackError(trackLabel, error);
      return false;
    }
  };

  const handleProceedToStageStep = async () => {
    if (!placeValid) {
      setPlaceTouched(true);
      return;
    }
    if (!reasonValid) {
      setReasonTouched(true);
      return;
    }
    await runStageGeneration({ processedImage: null, trackLabel: "stage_auto", autoSelect: true });
    router.push(`/${locale}/emokai/step/6`);
  };

  const handleProceedToCharacterStep = async () => {
    if (!appearanceValid) {
      setAppearanceTouched(true);
      return;
    }
    await runCharacterGeneration("character_auto");
    router.push(`/${locale}/emokai/step/10`);
  };

  const handleStageGenerateFromText = async () => {
    if (!stageDescriptionReady || reasonText.trim().length < MIN_TEXT_LENGTH) {
      setPlaceTouched(true);
      setReasonTouched(true);
      return;
    }
    await runStageGeneration({ processedImage: null, trackLabel: "stage_text_regen" });
  };

  const handleStageFileInput = () => {
    stageFileInputRef.current?.click();
  };

  const stageSelectionFromOptions = (id: string) => stageOptions.find((option) => option.id === id) ?? null;

  const handleStageFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setStageStatus("generating");
    setStageGenerationError(null);
    setStageOptions([]);
    setStageSelection(null);

    try {
      const processed = await processStageReference(file);
      await runStageGeneration({ processedImage: processed, trackLabel: "stage_options" });
    } catch (error) {
      console.error(error);
      // runStageGeneration already handled error state
    } finally {
      if (stageFileInputRef.current) {
        stageFileInputRef.current.value = "";
      }
    }
  };

  const handleStageRegenerate = async () => {
    if (stageProcessedImage) {
      await runStageGeneration({ processedImage: stageProcessedImage, trackLabel: "stage_options_regen" });
      return;
    }
    await runStageGeneration({ processedImage: null, trackLabel: "stage_options_regen" });
  };

  const handleStageSelect = (id: string) => {
    const option = stageSelectionFromOptions(id);
    if (!option) return;
    setStageSelection(option);
    persistStageSelection(option);
  };

  const handleStageNext = () => {
    if (!stageSelection) {
      setStageGenerationError(isJa ? "背景を選択してください" : "Select a background option.");
      return;
    }
    router.push(`/${locale}/emokai/step/7`);
  };

  const handleCharacterGenerate = async () => {
    if (characterPrompt.trim().length < MIN_TEXT_LENGTH) {
      setCharacterGenerationError(isJa ? "内容が短すぎます" : "Prompt is too short.");
      return;
    }
    await runCharacterGeneration("character_options");
  };

  const handleCharacterRegenerate = async () => {
    if (characterPrompt.trim().length < MIN_TEXT_LENGTH) {
      setCharacterGenerationError(isJa ? "内容が短すぎます" : "Prompt is too short.");
      return;
    }
    await runCharacterGeneration("character_options_regen");
  };

  const handleCharacterSelect = (id: string) => {
    const option = characterOptions.find((item) => item.id === id);
    if (!option) return;
    setCharacterSelection(option);
    persistCharacterSelection(option, characterPrompt);
  };

  const handleCharacterNext = () => {
    if (!characterSelection) {
      setCharacterGenerationError(isJa ? "エモカイを選択してください" : "Select an Emokai option.");
      return;
    }
    router.push(`/${locale}/emokai/step/11`);
  };

  const startGenerationJobs = async () => {
    if (!stageSelection || !characterSelection) {
      setGenerationError(isJa ? "背景とキャラクターを先に選択してください" : "Select both background and character first.");
      setGenerationState((prev) => ({ ...prev, model: "error", composite: "error", story: "error" }));
      return;
    }

    const lockAcquired = acquireGenerationLock();
    if (!lockAcquired) {
      setGenerationLockActive(true);
      setGenerationError(isJa ? "別の生成処理が実行中です" : "Another generation is in progress.");
      return;
    }

    setGenerationLockActive(true);
    setGenerationRunning(true);
    setGenerationError(null);
    setGenerationState({ model: "active", composite: "active", story: "active" });
    trackEvent("generation_start", { step: "jobs_step11", locale });

    const stageCacheEntry = getCachedImage(stageSelection.cacheKey);
    if (!stageCacheEntry) {
      setGenerationError(isJa ? "背景データが保存されていません" : "Background data missing.");
      releaseGenerationLock();
      setGenerationLockActive(false);
      setGenerationRunning(false);
      return;
    }

    const characterCacheEntry = getCachedImage(characterSelection.cacheKey);
    if (!characterCacheEntry) {
      setGenerationError(isJa ? "キャラクターデータが保存されていません" : "Character data missing.");
      releaseGenerationLock();
      setGenerationLockActive(false);
      setGenerationRunning(false);
      return;
    }

    const stageInput = {
      imageBase64: stageCacheEntry.base64,
      mimeType: stageCacheEntry.mimeType
    };
    const characterInput = {
      imageBase64: characterCacheEntry.base64,
      mimeType: characterCacheEntry.mimeType
    };

    const modelPromise = generateModel({
      characterId: characterSelection.id,
      description: characterPrompt,
      characterImage: characterInput
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

    const compositePromise = generateComposite(stageInput, characterInput)
      .then((composite) => {
        setGenerationState((prev) => ({ ...prev, composite: "complete" }));
        return composite;
      })
      .catch((error) => {
        console.error(error);
        setGenerationState((prev) => ({ ...prev, composite: "error" }));
        throw error;
      });

    const storyPromise = generateStory(storyPrompt, localeKey)
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
      const payload: StoredGenerationPayload = {
        characterId: characterSelection.id,
        description: characterPrompt,
        results: { model, composite, story },
        completedAt: Date.now()
      };
      setGenerationResults(payload);
      persistGenerationPayload(payload);
      trackEvent("generation_complete", { step: "jobs_step11", locale });
    } catch (error) {
      console.error(error);
      setGenerationError(isJa ? "生成処理でエラーが発生しました" : "Generation jobs failed.");
      trackError("jobs_step11", error);
    } finally {
      releaseGenerationLock();
      setGenerationLockActive(false);
      setGenerationRunning(false);
    }
  };

  useEffect(() => {
    if (step !== 11) return;
    if (generationRunning) return;
    if (generationResults) return;
    startGenerationJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const progressStages = useMemo(
    () => [
      { id: "model", label: isJa ? "3Dモデル" : "3D model", status: generationState.model },
      { id: "composite", label: isJa ? "合成" : "Composite", status: generationState.composite },
      { id: "story", label: isJa ? "物語" : "Story", status: generationState.story }
    ],
    [generationState, isJa]
  );

  const handleRegister = () => {
    setSaveStatus("saving");
    setSaveError(null);
    const result = saveCreation();
    if (result.success) {
      setSaveStatus("saved");
      setShareDetails({ url: result.shareUrl ?? "", expiresAt: result.expiresAt });
      setCreations(listCreations());
      router.push(`/${locale}/emokai/step/14`);
    } else {
      setSaveStatus("error");
      setSaveError(result.error ?? (isJa ? "登録に失敗しました" : "Failed to register."));
    }
  };

  const renderStageStep = () => (
    <section className="space-y-4">
      <StepLabel text={stepLabelText} />
      <h2 className="text-base font-semibold text-textPrimary">
        {isJa ? "イメージに合う場所" : "Choose a matching place"}
      </h2>
      <p className="text-sm text-textSecondary">
        {isJa
          ? "これまで入力した内容から背景候補を自動生成しました。気に入ったものを選ぶか、必要に応じて再生成してください。"
          : "We generated background candidates from your inputs. Pick your favorite or regenerate if needed."}
      </p>
      <RichInput
        label=""
        placeholder={
          isJa
            ? "都内の公園のベンチ、日当たりが心地よい..."
            : "A sun-drenched bench in a quiet park..."
        }
        value={placeText}
        onChange={handlePlaceChange}
        maxLength={300}
        helperText={stageHelperText ?? minLengthHint}
        error={stageModerationError ?? (placeTouched && !placeValid ? minLengthHint : undefined)}
      />
      <div className="rounded-2xl border border-divider bg-[rgba(237,241,241,0.04)] p-4 text-xs text-textSecondary">
        <p className="font-semibold text-textPrimary">{isJa ? "生成に使った情報" : "Prompt summary"}</p>
        <p className="whitespace-pre-wrap pt-2">{stagePrompt}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={handleStageGenerateFromText} disabled={stageStatus === "generating"}>
          {stageStatus === "generating" ? generatingLabel : isJa ? "テキストから再生成" : "Regenerate from text"}
        </Button>
        <Button
          type="button"
          onClick={handleStageFileInput}
          disabled={stageStatus === "generating"}
        >
          {isJa ? "参考画像をアップロード" : "Upload reference"}
        </Button>
        <input
          ref={stageFileInputRef}
          type="file"
          accept="image/*"
          hidden
          capture="environment"
          onChange={handleStageFileChange}
        />
      </div>
      {stageStatus === "generating" && (
        <MessageBlock title={isJa ? "背景生成中" : "Generating backgrounds"} body={<p>{isJa ? "しばらくお待ちください..." : "Please wait a moment..."}</p>} />
      )}
      {stageGenerationError && <p className="text-xs text-[#ffb9b9]">{stageGenerationError}</p>}
      {stageOptions.length > 0 && (
        <div className="space-y-3">
          <div className="grid gap-4">
            {stageOptions.map((option) => (
              <ImageOption
                key={option.id}
                id={option.id}
                selected={stageSelection?.id === option.id}
                onSelect={handleStageSelect}
                label={isJa ? "選択" : "Select"}
                image={<img src={option.previewUrl} alt={isJa ? "背景オプション" : "Stage option"} className="h-full w-full object-cover" />}
              />
            ))}
          </div>
          <div className="flex items-center justify-between text-xs text-textSecondary">
            <button type="button" className="underline" onClick={handleStageRegenerate}>
              {isJa ? "別の案を生成" : "Generate again"}
            </button>
            {stageProcessedImage ? (
              <span>
                {isJa ? "参考画像サイズ" : "Reference size"}: {Math.round(stageProcessedImage.size / 1024)} KB
              </span>
            ) : null}
          </div>
        </div>
      )}
      <div className="pt-2">
        <button
          type="button"
          className={`${primaryButtonClass} ${stageSelection ? "" : "opacity-50 pointer-events-none"}`}
          onClick={handleStageNext}
        >
          {selectNextLabel}
        </button>
      </div>
    </section>
  );

  const renderCharacterStep = () => (
    <section className="space-y-4">
      <StepLabel text={stepLabelText} />
      <h2 className="text-base font-semibold text-textPrimary">
        {isJa ? "エモカイを選ぶ" : "Choose your Emokai"}
      </h2>
      <p className="text-sm text-textSecondary">
        {isJa
          ? "これまでの入力をもとにエモカイの候補を生成します。気に入ったものを選んでください。"
          : "We will generate Emokai concepts based on your inputs. Pick the one that resonates."}
      </p>
      <div className="rounded-2xl border border-divider bg-[rgba(237,241,241,0.04)] p-4 text-xs text-textSecondary">
        <p className="font-semibold text-textPrimary">{isJa ? "生成に使う情報" : "Prompt summary"}</p>
        <p className="whitespace-pre-wrap pt-2">{characterPrompt}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={handleCharacterGenerate} disabled={characterStatus === "generating"}>
          {characterStatus === "generating" ? generatingLabel : isJa ? "候補を生成" : "Generate options"}
        </Button>
        {characterOptions.length > 0 ? (
          <Button type="button" onClick={handleCharacterRegenerate} disabled={characterStatus === "generating"}>
            {isJa ? "別の候補" : "Try again"}
          </Button>
        ) : null}
      </div>
      {characterGenerationError && <p className="text-xs text-[#ffb9b9]">{characterGenerationError}</p>}
      {characterStatus === "generating" && (
        <MessageBlock title={isJa ? "エモカイ生成中" : "Generating Emokai"} body={<p>{isJa ? "しばらくお待ちください..." : "Please wait..."}</p>} />
      )}
      {characterOptions.length > 0 && (
        <div className="grid gap-4">
          {characterOptions.map((option) => (
            <ImageOption
              key={option.id}
              id={option.id}
              selected={characterSelection?.id === option.id}
              onSelect={handleCharacterSelect}
              label={isJa ? "選択" : "Select"}
              image={<img src={option.previewUrl} alt={isJa ? "キャラクター候補" : "Character option"} className="h-full w-full object-cover" />}
            />
          ))}
        </div>
      )}
      <div className="pt-2">
        <button
          type="button"
          className={`${primaryButtonClass} ${characterSelection ? "" : "opacity-50 pointer-events-none"}`}
          onClick={handleCharacterNext}
        >
          {selectNextLabel}
        </button>
      </div>
    </section>
  );

  const renderGenerationStep = () => (
    <section className="space-y-4">
      <h2 className="text-base font-semibold text-textPrimary">
        {isJa ? "エモカイ生成中..." : "Generating your Emokai..."}
      </h2>
      <p className="text-sm text-textSecondary">
        {isJa
          ? "この場所に対する感情を、この場所に住まう感情の妖怪『エモカイ』へと昇華させています。"
          : "We are shaping your feelings into the Emokai that dwells in this place."}
      </p>
      <ProgressBar stages={progressStages} />
      {generationError ? (
        <p className="text-xs text-[#ffb9b9]">{generationError}</p>
      ) : (
        <p className="text-xs text-textSecondary opacity-70">
          {isJa ? "処理が完了すると次へ進めます" : "You can continue once the generation finishes."}
        </p>
      )}
      <div className="pt-2">
        <button
          type="button"
          className={`${primaryButtonClass} ${
            generationResults &&
            generationState.model === "complete" &&
            generationState.composite === "complete" &&
            generationState.story === "complete"
              ? ""
              : "opacity-50 pointer-events-none"
          }`}
          onClick={() => router.push(`/${locale}/emokai/step/12`)}
        >
          {nextLabel}
        </button>
      </div>
    </section>
  );

  const renderDiscoveryStep = () => (
    <section className="space-y-4">
      <h2 className="text-base font-semibold text-textPrimary">
        {isJa ? "新しいエモカイが発見されました！" : "A new Emokai has been discovered!"}
      </h2>
      <p className="text-sm text-textSecondary">
        {isJa
          ? "エモカイが現れました。データを整えています..."
          : "Your Emokai has appeared. Preparing the data..."}
      </p>
      <div className="aspect-square w-full overflow-hidden rounded-2xl border border-divider bg-[rgba(237,241,241,0.08)]">
        {(() => {
          const composite = generationResults?.results.composite;
          if (!composite) return null;
          const url =
            (composite.url && (composite.url.startsWith("data:") || /^https?:/i.test(composite.url))
              ? composite.url
              : null) ??
            (composite.imageBase64 && composite.mimeType
              ? `data:${composite.mimeType};base64,${composite.imageBase64}`
              : null);
          if (!url) return null;
          return (
            <img
              src={url}
              alt={isJa ? "エモカイの合成画像" : "Emokai composite"}
              className="h-full w-full object-cover"
            />
          );
        })()}
      </div>
      <div className="pt-2">
        <button type="button" className={primaryButtonClass} onClick={() => router.push(`/${locale}/emokai/step/13`)}>
          {nextLabel}
        </button>
      </div>
    </section>
  );

  const renderDetailStep = () => (
    <section className="space-y-4">
      <h2 className="text-base font-semibold text-textPrimary">
        {isJa ? "エモカイ詳細" : "Emokai details"}
      </h2>
      <div className="space-y-3 rounded-2xl border border-divider p-4 text-sm text-textSecondary">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] opacity-70">{isJa ? "ナンバー" : "Number"}</p>
          <p>No. {creations.length + 1}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] opacity-70">{isJa ? "名前" : "Name"}</p>
          <p>{isJa ? `エモカイ ${creations.length + 1}` : `Emokai ${creations.length + 1}`}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] opacity-70">{isJa ? "場所" : "Place"}</p>
          <p>{placeText || "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] opacity-70">{isJa ? "抱く感情" : "Emotions"}</p>
          <p>{selectedEmotions.length ? selectedEmotions.join(isJa ? "、" : ", ") : "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] opacity-70">{isJa ? "行動" : "Action"}</p>
          <p>{actionText || "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] opacity-70">{isJa ? "外見" : "Appearance"}</p>
          <p>{appearanceText || "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] opacity-70">{isJa ? "物語" : "Story"}</p>
          <p className="whitespace-pre-wrap text-textPrimary">
            {generationResults?.results.story.content || "—"}
          </p>
        </div>
      </div>
      {saveStatus === "error" && saveError ? <p className="text-xs text-[#ffb9b9]">{saveError}</p> : null}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          className={`${primaryButtonClass} ${saveStatus === "saving" ? "opacity-50 pointer-events-none" : ""}`}
          onClick={handleRegister}
        >
          {saveStatus === "saving" ? (isJa ? "登録中..." : "Saving...") : registerLabel}
        </button>
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={() => router.push(`/${locale}/emokai/step/12`)}
        >
          {isJa ? "前の画面へ" : "Back"}
        </button>
      </div>
      {shareDetails ? (
        <div className="rounded-2xl border border-divider bg-[rgba(237,241,241,0.04)] p-4 text-xs text-textSecondary">
          <p className="font-semibold text-textPrimary">{isJa ? "共有リンク" : "Share link"}</p>
          <p className="break-all pt-2">{shareDetails.url}</p>
          {shareDetails.expiresAt ? (
            <p className="pt-1">
              {isJa ? "有効期限" : "Expires"}: {formatDate(shareDetails.expiresAt, localeKey)}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );

  const renderSummonStep = () => (
    <section className="space-y-4">
      <h2 className="text-base font-semibold text-textPrimary">
        {isJa ? "エモカイを呼び出す" : "Summon the Emokai"}
      </h2>
      <p className="text-sm text-textSecondary">
        {isJa
          ? "ARカメラを開いて、エモカイを現実世界に呼び出しましょう。"
          : "Launch the AR camera to bring your Emokai into the world."}
      </p>
      <div className="space-y-3 text-xs text-textSecondary">
        <p>{isJa ? "十分な明るさのある場所でご利用ください。" : "Use in a well-lit area for best results."}</p>
        <p>{isJa ? "平らな面を検出すると配置できます。" : "Once a flat surface is detected you can place the Emokai."}</p>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" className={primaryButtonClass} onClick={() => router.push(`/${locale}/ar`)}>
          {summonLabel}
        </button>
        <button type="button" className={secondaryButtonClass} onClick={() => router.push(`/${locale}/emokai/step/15`)}>
          {nextLabel}
        </button>
      </div>
    </section>
  );

  const renderGalleryStep = () => (
    <section className="space-y-4">
      <h2 className="text-base font-semibold text-textPrimary">
        {isJa ? "エモカイコレクション" : "Emokai collection"}
      </h2>
      {creations.length === 0 ? (
        <MessageBlock
          title={isJa ? "まだエモカイが登録されていません" : "No creations yet"}
          body={<p>{isJa ? "エモカイを作成してコレクションに追加しましょう。" : "Create an Emokai to populate your collection."}</p>}
        />
      ) : (
        <div className="grid gap-4">
          {creations.map((creation, index) => {
            const stage = (creation.stageSelection as StageSelectionPayload | null)?.selectedOption;
            const character = (creation.characterSelection as CharacterSelectionPayload | null)?.selectedOption;
            const results = creation.results as StoredGenerationPayload["results"] | undefined;
            const story = results?.story;
            const composite = results?.composite as (CompositeResult & { mimeType?: string }) | undefined;
            const compositeUrl =
              (composite?.url && (composite.url.startsWith("data:") || /^https?:/i.test(composite.url))
                ? composite.url
                : undefined) ??
              (composite?.imageBase64 && composite?.mimeType
                ? `data:${composite.mimeType};base64,${composite.imageBase64}`
                : undefined);
            return (
              <div
                key={`${creation.createdAt}-${index}`}
                className="overflow-hidden rounded-3xl border border-divider bg-[rgba(237,241,241,0.04)]"
              >
                {compositeUrl ? (
                  <img src={compositeUrl} alt={isJa ? "生成画像" : "Generated composite"} className="h-40 w-full object-cover" />
                ) : stage?.previewUrl ? (
                  <img src={stage.previewUrl} alt={isJa ? "生成背景" : "Generated stage"} className="h-40 w-full object-cover" />
                ) : null}
                <div className="space-y-2 p-4 text-xs text-textSecondary">
                  <p className="font-semibold text-textPrimary">{formatDate(creation.createdAt, localeKey)}</p>
                  <p className="line-clamp-2 text-textPrimary">{story?.content ?? ""}</p>
                  {character?.previewUrl ? (
                    <img
                      src={character.previewUrl}
                      alt={isJa ? "エモカイ" : "Emokai"}
                      className="h-24 w-full rounded-2xl object-cover"
                    />
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="pt-2">
        <Link href={`/${locale}/start`} className={primaryButtonClass}>
          {createAnotherLabel}
        </Link>
      </div>
    </section>
  );

  const content = (() => {
    switch (step) {
      case 1:
        return (
          <section className="space-y-3">
            <InstructionBanner tone="default">
              {isJa ? "感情の妖怪を発見する旅へ" : "Embark on a journey to discover the yokai of feelings."}
            </InstructionBanner>
            <h2 className="text-base font-semibold text-textPrimary">EMOKAI</h2>
            <p className="text-sm text-textSecondary">
              {isJa ? "感情の妖怪を発見する旅へ" : "Embark on a journey to discover the yokai of feelings."}
            </p>
            <div className="pt-4">
              <button type="button" className={primaryButtonClass} onClick={() => router.push(`/${locale}/emokai/step/2`)}>
                {isJa ? "はじめる" : "Begin"}
              </button>
            </div>
          </section>
        );
      case 2:
        return (
          <section className="space-y-3">
            <StepLabel text={stepLabelText} />
            <h2 className="text-base font-semibold text-textPrimary">
              {isJa ? "エモカイとは" : "What is Emokai"}
            </h2>
            <p className="text-sm text-textSecondary">
              {isJa
                ? "あなたにとって、大切な場所を思い浮かべてください。なぜか忘れられない場所、気づくとそこにいる場所、なんとなく写真に撮った場所..."
                : "Picture the place that matters to you. A place you can’t forget, a place you return to, or a place you once photographed on a whim..."}
            </p>
            <div className="pt-4">
              <button type="button" className={primaryButtonClass} onClick={() => router.push(`/${locale}/emokai/step/3`)}>
                {nextLabel}
              </button>
            </div>
          </section>
        );
      case 3:
        return (
          <section className="space-y-3">
            <StepLabel text={stepLabelText} />
            <h2 className="text-base font-semibold text-textPrimary">
              {isJa ? "大切な場所を思い浮かべる" : "Imagine your precious place"}
            </h2>
            <p className="text-sm text-textSecondary">
              {isJa
                ? "目を瞑り、その場所を妄想で歩いてください...なにかが動くのを感じる..."
                : "Close your eyes and walk through that place in your imagination... you feel something begin to stir..."}
            </p>
            <div className="pt-4">
              <button type="button" className={primaryButtonClass} onClick={() => router.push(`/${locale}/emokai/step/4`)}>
                {nextLabel}
              </button>
            </div>
          </section>
        );
      case 4:
        return (
          <section className="space-y-3">
            <StepLabel text={stepLabelText} />
            <h2 className="text-base font-semibold text-textPrimary">
              {isJa ? "あなたの大切な場所" : "Your precious place"}
            </h2>
            <p className="text-sm text-textSecondary">
              {isJa
                ? "あなたにとって大切な場所について教えてください（地名、見えているもの、雰囲気など）"
                : "Tell us about the place that matters to you (location, what you see, the atmosphere, etc.)."}
            </p>
            <RichInput
              label=""
              placeholder={
                isJa
                  ? "都内の公園のベンチ、日当たりが心地よい..."
                  : "A sunny bench in a Tokyo park where the light feels warm..."
              }
              value={placeText}
              onChange={handlePlaceChange}
              maxLength={300}
              helperText={minLengthHint}
              error={placeTouched && !placeValid ? minLengthHint : undefined}
            />
            <div className="pt-2">
              <button
                type="button"
                className={primaryButtonClass}
                onClick={() => {
                  if (!placeValid) {
                    setPlaceTouched(true);
                    return;
                  }
                  router.push(`/${locale}/emokai/step/5`);
                }}
              >
                {nextLabel}
              </button>
            </div>
          </section>
        );
      case 5:
        return (
          <section className="space-y-3">
            <StepLabel text={stepLabelText} />
            <h2 className="text-base font-semibold text-textPrimary">
              {isJa ? "場所への想い" : "Feelings for the place"}
            </h2>
            <p className="text-sm text-textSecondary">
              {isJa ? "その場所は、なぜあなたにとって大切なのですか？" : "Why is this place important to you?"}
            </p>
            <RichInput
              label=""
              placeholder={isJa ? "自由記述" : "Free text"}
              value={reasonText}
              onChange={handleReasonChange}
              maxLength={300}
              helperText={minLengthHint}
              error={reasonTouched && !reasonValid ? minLengthHint : undefined}
            />
            {stageStatus === "generating" ? (
              <p className="text-xs text-textSecondary">{generatingLabel}</p>
            ) : null}
            <div className="pt-2">
              <button
                type="button"
                className={`${primaryButtonClass} ${stageStatus === "generating" ? "opacity-60" : ""}`}
                onClick={handleProceedToStageStep}
                disabled={stageStatus === "generating"}
              >
                {nextLabel}
              </button>
            </div>
          </section>
        );
      case 6:
        return renderStageStep();
      case 7:
        return (
          <section className="space-y-4">
            <StepLabel text={stepLabelText} />
            <h2 className="text-base font-semibold text-textPrimary">
              {isJa ? "場所への感情" : "Emotions toward the place"}
            </h2>
            <p className="text-sm text-textSecondary">
              {isJa ? "その場所に対して抱く感情を選択してください。" : "Select the emotions you feel toward this place."}
            </p>
            <div className="flex flex-wrap gap-2">
              {BASIC_EMOTIONS.map((emotion) => {
                const selected = selectedEmotions.includes(emotion);
                return (
                  <button
                    key={emotion}
                    type="button"
                    className={pillClass(selected)}
                    onClick={() => toggleEmotion(emotion)}
                  >
                    {emotion}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-textSecondary opacity-70">
              {isJa ? "詳細な感情も選択できます" : "You can also choose detailed emotions"}
            </p>
            <div className="flex flex-wrap gap-2">
              {DETAIL_EMOTIONS.map((emotion) => {
                const selected = selectedEmotions.includes(emotion);
                return (
                  <button
                    key={emotion}
                    type="button"
                    className={pillClass(selected)}
                    onClick={() => toggleEmotion(emotion)}
                  >
                    {emotion}
                  </button>
                );
              })}
            </div>
            {!emotionValid && emotionTouched ? <p className="text-xs text-[#ffb9b9]">{selectOneHint}</p> : null}
            <div className="pt-2">
              <button
                type="button"
                className={primaryButtonClass}
                onClick={() => {
                  if (!emotionValid) {
                    setEmotionTouched(true);
                    return;
                  }
                  router.push(`/${locale}/emokai/step/8`);
                }}
              >
                {nextLabel}
              </button>
            </div>
          </section>
        );
      case 8:
        return (
          <section className="space-y-3">
            <StepLabel text={stepLabelText} />
            <h2 className="text-base font-semibold text-textPrimary">
              {isJa ? "エモカイのアクション" : "Emokai's action"}
            </h2>
            <p className="text-sm text-textSecondary">
              {isJa
                ? "あなたのエモカイはこの場所に来たあなたに、何をしますか？具体的なアクションを教えてください。"
                : "When you arrive at this place, what does your Emokai do? Describe their action."}
            </p>
            <RichInput
              label=""
              placeholder={isJa ? "自由記述" : "Free text"}
              value={actionText}
              onChange={handleActionChange}
              maxLength={300}
              helperText={minLengthHint}
              error={actionTouched && !actionValid ? minLengthHint : undefined}
            />
            <div className="pt-2">
              <button
                type="button"
                className={primaryButtonClass}
                onClick={() => {
                  if (!actionValid) {
                    setActionTouched(true);
                    return;
                  }
                  router.push(`/${locale}/emokai/step/9`);
                }}
              >
                {nextLabel}
              </button>
            </div>
          </section>
        );
      case 9:
        return (
          <section className="space-y-3">
            <StepLabel text={stepLabelText} />
            <h2 className="text-base font-semibold text-textPrimary">
              {isJa ? "エモカイの姿" : "Appearance of the Emokai"}
            </h2>
            <p className="text-sm text-textSecondary">
              {isJa
                ? "あなたのエモカイはどのような見た目でしょうか？他にも思いつく特徴を教えてください。"
                : "Describe what your Emokai looks like. Include any notable characteristics."}
            </p>
            <RichInput
              label=""
              placeholder={isJa ? "自由記述" : "Free text"}
              value={appearanceText}
              onChange={handleAppearanceChange}
              maxLength={400}
              helperText={minLengthHint}
              error={appearanceTouched && !appearanceValid ? minLengthHint : undefined}
            />
            {characterStatus === "generating" ? (
              <p className="text-xs text-textSecondary">{generatingLabel}</p>
            ) : null}
            <div className="pt-2">
              <button
                type="button"
                className={`${primaryButtonClass} ${characterStatus === "generating" ? "opacity-60" : ""}`}
                onClick={handleProceedToCharacterStep}
                disabled={characterStatus === "generating"}
              >
                {nextLabel}
              </button>
            </div>
          </section>
        );
      case 10:
        return renderCharacterStep();
      case 11:
        return renderGenerationStep();
      case 12:
        return renderDiscoveryStep();
      case 13:
        return renderDetailStep();
      case 14:
        return renderSummonStep();
      case 15:
        return renderGalleryStep();
      default:
        return null;
    }
  })();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-canvas">
      <Header title="EMOKAI" />
      <Divider />
      <div className="space-y-6 px-4 py-6 sm:px-6">{content}</div>
    </main>
  );
}
