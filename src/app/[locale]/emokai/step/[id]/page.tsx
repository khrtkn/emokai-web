"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Divider, Header, InstructionBanner, ImageOption, RichInput } from "@/components/ui";
import { EMOKAI_COLLECTION_KEY } from "@/lib/storage-keys";

type Props = { params: { locale: string; id: string } };

type OptionLabel = {
  id: string;
  label: {
    ja: string;
    en: string;
  };
};

type EmokaiEntry = {
  id: string;
  createdAt: string;
  locale: string;
  name: string;
  placeDescription: string;
  reason: string;
  emotions: string[];
  action: string;
  appearance: string;
  placeOptionId: string | null;
  placeOptionLabel: string | null;
  characterOptionId: string | null;
  characterOptionLabel: string | null;
};

const StepLabel = ({ text }: { text?: string }) => {
  if (!text) return null;
  return <p className="text-xs text-textSecondary">{text}</p>;
};

const PlaceholderImage = ({ label }: { label: string }) => (
  <div className="flex h-full w-full items-center justify-center bg-[rgba(237,241,241,0.05)] text-xs text-textSecondary">
    {label}
  </div>
);

const MIN_TEXT_LENGTH = 10;
const TOTAL_STEPS = 15;

const PLACE_STORAGE_KEY = "emokai_place";
const REASON_STORAGE_KEY = "emokai_reason";
const EMOTIONS_STORAGE_KEY = "emokai_emotions";
const ACTION_STORAGE_KEY = "emokai_action";
const APPEARANCE_STORAGE_KEY = "emokai_appearance";
const PLACE_CHOICE_KEY = "emokai_place_choice";
const CHARACTER_CHOICE_KEY = "emokai_character_choice";

const PLACE_OPTIONS: OptionLabel[] = [
  { id: "place-1", label: { ja: "都市の公園", en: "Urban park" } },
  { id: "place-2", label: { ja: "静かな図書館", en: "Quiet library" } },
  { id: "place-3", label: { ja: "夜の海辺", en: "Night seaside" } },
  { id: "place-4", label: { ja: "山の神社", en: "Mountain shrine" } }
];

const CHARACTER_OPTIONS: OptionLabel[] = [
  { id: "character-1", label: { ja: "柔らかな光", en: "Soft light" } },
  { id: "character-2", label: { ja: "波紋の布", en: "Rippled cloth" } },
  { id: "character-3", label: { ja: "霧の翼", en: "Mist wings" } },
  { id: "character-4", label: { ja: "音の粒", en: "Grains of sound" } }
];

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

const loadCollection = (): EmokaiEntry[] => {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(EMOKAI_COLLECTION_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as EmokaiEntry[]) : [];
  } catch {
    return [];
  }
};

const saveCollection = (entries: EmokaiEntry[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(EMOKAI_COLLECTION_KEY, JSON.stringify(entries));
};

const getOptionLabel = (options: OptionLabel[], id: string | null, localeKey: "ja" | "en") => {
  if (!id) return null;
  return options.find((opt) => opt.id === id)?.label[localeKey] ?? null;
};

const formatDate = (value: string, locale: string) => {
  try {
    return new Date(value).toLocaleString(locale === "ja" ? "ja-JP" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  } catch {
    return value;
  }
};

export default function EmokaiStepPage({ params }: Props) {
  const { locale, id } = params;
  const router = useRouter();

  const localeKey: "ja" | "en" = locale === "ja" ? "ja" : "en";
  const isJa = localeKey === "ja";

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

  const next = (n: number) => `/${locale}/emokai/step/${n}`;

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

  const initialPlaceChoice = useMemo(() => {
    const stored = loadSessionString(PLACE_CHOICE_KEY, "");
    return stored || null;
  }, []);
  const [placeChoice, setPlaceChoice] = useState<string | null>(initialPlaceChoice);
  const [placeChoiceError, setPlaceChoiceError] = useState(false);

  const initialEmotions = useMemo(() => loadSessionArray(EMOTIONS_STORAGE_KEY), []);
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>(initialEmotions);
  const [emotionTouched, setEmotionTouched] = useState(initialEmotions.length > 0);
  const emotionValid = selectedEmotions.length > 0;

  const initialCharacterChoice = useMemo(() => {
    const stored = loadSessionString(CHARACTER_CHOICE_KEY, "");
    return stored || null;
  }, []);
  const [characterChoice, setCharacterChoice] = useState<string | null>(initialCharacterChoice);
  const [characterChoiceError, setCharacterChoiceError] = useState(false);

  const [collection, setCollection] = useState<EmokaiEntry[]>(() => loadCollection());
  useEffect(() => {
    if (step === 15) {
      setCollection(loadCollection());
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
  const loadingNote = isJa
    ? "処理が完了したら次へ進めます"
    : "You can continue once the process finishes.";
  const noCollectionText = isJa ? "まだエモカイが登録されていません。" : "No Emokai saved yet.";

  const pillClass = (selected: boolean) =>
    `rounded-full border px-3 py-2 text-xs transition ${
      selected
        ? "border-transparent bg-accent text-black"
        : "border-divider text-textSecondary hover:border-accent"
    }`;

  const primaryButtonClass =
    "inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90";
  const secondaryButtonClass =
    "inline-block rounded-lg border border-divider px-4 py-2 text-sm text-textPrimary transition hover:border-accent";

  const handlePlaceChange = (value: string) => {
    setPlaceTouched(true);
    setPlaceText(value);
    saveSessionString(PLACE_STORAGE_KEY, value);
  };

  const handleReasonChange = (value: string) => {
    setReasonTouched(true);
    setReasonText(value);
    saveSessionString(REASON_STORAGE_KEY, value);
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
  };

  const handlePlaceSelect = (optionId: string) => {
    setPlaceChoice(optionId);
    setPlaceChoiceError(false);
    saveSessionString(PLACE_CHOICE_KEY, optionId);
  };

  const handlePlaceNext = () => {
    if (!placeChoice) {
      setPlaceChoiceError(true);
      return;
    }
    router.push(next(7));
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

  const handleEmotionNext = () => {
    if (!emotionValid) {
      setEmotionTouched(true);
      return;
    }
    router.push(next(8));
  };

  const handleCharacterSelect = (optionId: string) => {
    setCharacterChoice(optionId);
    setCharacterChoiceError(false);
    saveSessionString(CHARACTER_CHOICE_KEY, optionId);
  };

  const handleCharacterNext = () => {
    if (!characterChoice) {
      setCharacterChoiceError(true);
      return;
    }
    router.push(next(11));
  };

  const handleRegister = () => {
    const existing = loadCollection();
    const placeLabel = getOptionLabel(PLACE_OPTIONS, placeChoice, localeKey);
    const characterLabel = getOptionLabel(CHARACTER_OPTIONS, characterChoice, localeKey);

    const entry: EmokaiEntry = {
      id: `emokai-${Date.now()}`,
      createdAt: new Date().toISOString(),
      locale,
      name: isJa ? `エモカイ ${existing.length + 1}` : `Emokai ${existing.length + 1}`,
      placeDescription: placeText,
      reason: reasonText,
      emotions: selectedEmotions,
      action: actionText,
      appearance: appearanceText,
      placeOptionId: placeChoice,
      placeOptionLabel: placeLabel,
      characterOptionId: characterChoice,
      characterOptionLabel: characterLabel
    };

    const updated = [entry, ...existing];
    saveCollection(updated);
    setCollection(updated);
    router.push(next(14));
  };

  const placeDisplayLabel = (optionId: string | null) =>
    getOptionLabel(PLACE_OPTIONS, optionId, localeKey) ?? (placeText.trim() || "—");

  const characterDisplayLabel = (optionId: string | null) =>
    getOptionLabel(CHARACTER_OPTIONS, optionId, localeKey) ?? (isJa ? "未選択" : "Not selected");

  const stepLabelText = (() => {
    if (step >= 2 && step <= 9) {
      const index = step - 1;
      return `Step. ${index}/8`;
    }
    return undefined;
  })();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-canvas">
      <Header title="EMOKAI" />
      <Divider />
      <div className="space-y-6 px-4 py-6 sm:px-6">
        {step === 1 && (
          <>
            <InstructionBanner tone="default">
              {isJa ? "感情の妖怪を発見する旅へ" : "Embark on a journey to discover the yokai of feelings."}
            </InstructionBanner>
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-textPrimary">EMOKAI</h2>
              <p className="text-sm text-textSecondary">
                {isJa ? "感情の妖怪を発見する旅へ" : "Embark on a journey to discover the yokai of feelings."}
              </p>
              <div className="pt-4">
                <button type="button" className={primaryButtonClass} onClick={() => router.push(next(2))}>
                  {isJa ? "はじめる" : "Begin"}
                </button>
              </div>
            </section>
          </>
        )}

        {step === 2 && (
          <>
            <StepLabel text={stepLabelText} />
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-textPrimary">
                {isJa ? "エモカイとは" : "What is Emokai"}
              </h2>
              <p className="text-sm text-textSecondary">
                {isJa
                  ? "あなたにとって、大切な場所を思い浮かべてください。なぜか忘れられない場所、気づくとそこにいる場所、なんとなく写真に撮った場所..."
                  : "Picture the place that matters to you. A place you can’t forget, a place you return to, or a place you once photographed on a whim..."}
              </p>
              <div className="pt-4">
                <button type="button" className={primaryButtonClass} onClick={() => router.push(next(3))}>
                  {nextLabel}
                </button>
              </div>
            </section>
          </>
        )}

        {step === 3 && (
          <>
            <StepLabel text={stepLabelText} />
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-textPrimary">
                {isJa ? "大切な場所を思い浮かべる" : "Imagine your precious place"}
              </h2>
              <p className="text-sm text-textSecondary">
                {isJa
                  ? "目を瞑り、その場所を妄想で歩いてください...なにかが動くのを感じる..."
                  : "Close your eyes and walk through that place in your imagination... you feel something begin to stir..."}
              </p>
              <div className="pt-4">
                <button type="button" className={primaryButtonClass} onClick={() => router.push(next(4))}>
                  {nextLabel}
                </button>
              </div>
            </section>
          </>
        )}

        {step === 4 && (
          <>
            <StepLabel text={stepLabelText} />
            <section className="space-y-3">
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
                <button type="button" className={primaryButtonClass} onClick={() => {
                  if (!placeValid) {
                    setPlaceTouched(true);
                    return;
                  }
                  router.push(next(5));
                }}>
                  {nextLabel}
                </button>
              </div>
            </section>
          </>
        )}

        {step === 5 && (
          <>
            <StepLabel text={stepLabelText} />
            <section className="space-y-3">
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
              <div className="pt-2">
                <button type="button" className={primaryButtonClass} onClick={() => {
                  if (!reasonValid) {
                    setReasonTouched(true);
                    return;
                  }
                  router.push(next(6));
                }}>
                  {nextLabel}
                </button>
              </div>
            </section>
          </>
        )}

        {step === 6 && (
          <>
            <StepLabel text={stepLabelText} />
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-textPrimary">
                {isJa ? "イメージに合う場所" : "Choose a matching place"}
              </h2>
              <p className="text-sm text-textSecondary">
                {isJa ? "あなたのイメージに合う場所を選択してください。" : "Select the place that matches your image."}
              </p>
              <div className="grid gap-4 pt-2">
                {PLACE_OPTIONS.map((option) => (
                  <ImageOption
                    key={option.id}
                    id={option.id}
                    label={option.label[localeKey]}
                    image={<PlaceholderImage label={option.label[localeKey]} />}
                    selected={placeChoice === option.id}
                    onSelect={handlePlaceSelect}
                  />
                ))}
              </div>
              {placeChoiceError && <p className="text-xs text-[#ffb9b9]">{selectOneHint}</p>}
              <div className="pt-2">
                <button type="button" className={primaryButtonClass} onClick={handlePlaceNext}>
                  {selectNextLabel}
                </button>
              </div>
            </section>
          </>
        )}

        {step === 7 && (
          <>
            <StepLabel text={stepLabelText} />
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-textPrimary">
                {isJa ? "場所への感情" : "Emotions for the place"}
              </h2>
              <p className="text-sm text-textSecondary">
                {isJa ? "その場所に対して抱く感情を選択してください。" : "Select the emotions you feel for this place."}
              </p>
              <div className="space-y-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-textSecondary">
                    {isJa ? "基本感情" : "Primary emotions"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {BASIC_EMOTIONS.map((emotion) => {
                      const selected = selectedEmotions.includes(emotion);
                      return (
                        <button
                          type="button"
                          key={emotion}
                          className={pillClass(selected)}
                          onClick={() => toggleEmotion(emotion)}
                        >
                          {emotion}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-textSecondary">
                    {isJa ? "詳細感情" : "Secondary emotions"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {DETAIL_EMOTIONS.map((emotion) => {
                      const selected = selectedEmotions.includes(emotion);
                      return (
                        <button
                          type="button"
                          key={emotion}
                          className={pillClass(selected)}
                          onClick={() => toggleEmotion(emotion)}
                        >
                          {emotion}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              {emotionTouched && !emotionValid && <p className="text-xs text-[#ffb9b9]">{selectOneHint}</p>}
              <div className="pt-2">
                <button type="button" className={primaryButtonClass} onClick={handleEmotionNext}>
                  {selectNextLabel}
                </button>
              </div>
            </section>
          </>
        )}

        {step === 8 && (
          <>
            <StepLabel text={stepLabelText} />
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-textPrimary">
                {isJa ? "エモカイのアクション" : "Emokai’s action"}
              </h2>
              <p className="text-sm text-textSecondary">
                {isJa
                  ? "あなたのエモカイはこの場所に来たあなたに、何をしますか？具体的なアクションを教えてください。"
                  : "What does your Emokai do when you arrive at this place? Describe the action."}
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
                <button type="button" className={primaryButtonClass} onClick={() => {
                  if (!actionValid) {
                    setActionTouched(true);
                    return;
                  }
                  router.push(next(9));
                }}>
                  {nextLabel}
                </button>
              </div>
            </section>
          </>
        )}

        {step === 9 && (
          <>
            <StepLabel text={stepLabelText} />
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-textPrimary">
                {isJa ? "エモカイの姿" : "Emokai’s appearance"}
              </h2>
              <p className="text-sm text-textSecondary">
                {isJa ? "あなたのエモカイはどのような見た目なのでしょうか？" : "What does your Emokai look like?"}
              </p>
              <p className="text-sm text-textSecondary">
                {isJa ? "他にも思いつく特徴を教えてください。（動き、色、匂い、口癖など）" : "Share any other traits (movement, colors, scents, catchphrases, etc.)."}
              </p>
              <RichInput
                label=""
                placeholder={isJa ? "自由記述" : "Free text"}
                value={appearanceText}
                onChange={handleAppearanceChange}
                maxLength={300}
                helperText={minLengthHint}
                error={appearanceTouched && !appearanceValid ? minLengthHint : undefined}
              />
              <div className="pt-2">
                <button type="button" className={primaryButtonClass} onClick={() => {
                  if (!appearanceValid) {
                    setAppearanceTouched(true);
                    return;
                  }
                  router.push(next(10));
                }}>
                  {nextLabel}
                </button>
              </div>
            </section>
          </>
        )}

        {step === 10 && (
          <>
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-textPrimary">
                {isJa ? "エモカイを選ぶ" : "Choose the Emokai"}
              </h2>
              <p className="text-sm text-textSecondary">
                {isJa ? "あなたのイメージに合うエモカイを選択してください。" : "Select the Emokai that matches your image."}
              </p>
              <div className="grid gap-4 pt-2">
                {CHARACTER_OPTIONS.map((option) => (
                  <ImageOption
                    key={option.id}
                    id={option.id}
                    label={option.label[localeKey]}
                    image={<PlaceholderImage label={option.label[localeKey]} />}
                    selected={characterChoice === option.id}
                    onSelect={handleCharacterSelect}
                  />
                ))}
              </div>
              {characterChoiceError && <p className="text-xs text-[#ffb9b9]">{selectOneHint}</p>}
              <div className="pt-2">
                <button type="button" className={primaryButtonClass} onClick={handleCharacterNext}>
                  {selectNextLabel}
                </button>
              </div>
            </section>
          </>
        )}

        {step === 11 && (
          <>
            <section className="space-y-4">
              <h2 className="text-base font-semibold text-textPrimary">
                {isJa ? "エモカイ生成中..." : "Generating your Emokai..."}
              </h2>
              <div className="flex items-center gap-3 text-sm text-textSecondary">
                <span
                  className="h-4 w-4 animate-spin rounded-full border border-divider border-t-transparent"
                  aria-hidden
                />
                <span>{generatingLabel}</span>
              </div>
              <p className="text-sm text-textSecondary">
                {isJa
                  ? "この場所に対する感情を、この場所に住まう感情の妖怪「エモカイ」へと昇華させていきます..."
                  : "We are elevating your feelings into the Emokai who dwells in this place..."}
              </p>
              <p className="text-sm text-textSecondary">
                {isJa
                  ? "あなたの感情は今、はじめて質量を持ち、常世に現れ始めている..."
                  : "Your feelings are gaining form and beginning to appear..."}
              </p>
              <p className="text-xs text-textSecondary opacity-70">{loadingNote}</p>
              <div className="pt-2">
                <button type="button" className={primaryButtonClass} onClick={() => router.push(next(12))}>
                  {nextLabel}
                </button>
              </div>
            </section>
          </>
        )}

        {step === 12 && (
          <>
            <section className="space-y-4">
              <h2 className="text-base font-semibold text-textPrimary">
                {isJa ? "新しいエモカイが発見されました！" : "A new Emokai has been discovered!"}
              </h2>
              <p className="text-sm text-textSecondary">
                {isJa
                  ? "エモカイが発見されました。データベースへ登録しています..."
                  : "We found an Emokai and are registering it in the database..."}
              </p>
              <div className="aspect-square w-full overflow-hidden rounded-2xl border border-divider bg-[rgba(237,241,241,0.08)]" />
              <div className="pt-2">
                <button type="button" className={primaryButtonClass} onClick={() => router.push(next(13))}>
                  {nextLabel}
                </button>
              </div>
            </section>
          </>
        )}

        {step === 13 && (
          <>
            <section className="space-y-4">
              <h2 className="text-base font-semibold text-textPrimary">
                {isJa ? "エモカイ詳細" : "Emokai details"}
              </h2>
              <div className="space-y-3 rounded-2xl border border-divider p-4 text-sm text-textSecondary">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] opacity-70">{isJa ? "ナンバー" : "Number"}</p>
                  <p>No. {collection.length + 1}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] opacity-70">{isJa ? "名前" : "Name"}</p>
                  <p>{isJa ? `エモカイ ${collection.length + 1}` : `Emokai ${collection.length + 1}`}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] opacity-70">{isJa ? "ホスト" : "Host"}</p>
                  <p>{isJa ? "あなた" : "You"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] opacity-70">{isJa ? "感情" : "Emotion"}</p>
                  <p>{selectedEmotions.length ? selectedEmotions.join(", ") : "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] opacity-70">{isJa ? "ストーリー" : "Story"}</p>
                  <p>{actionText || "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] opacity-70">{isJa ? "場所" : "Place"}</p>
                  <p>{placeDisplayLabel(placeChoice)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] opacity-70">{isJa ? "外見" : "Appearance"}</p>
                  <p>{appearanceText || "—"}</p>
                </div>
              </div>
              <div className="pt-2">
                <button type="button" className={primaryButtonClass} onClick={handleRegister}>
                  {registerLabel}
                </button>
              </div>
            </section>
          </>
        )}

        {step === 14 && (
          <>
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-textPrimary">
                {isJa ? "エモカイを呼び出す" : "Summon your Emokai"}
              </h2>
              <p className="text-sm text-textSecondary">
                {isJa ? "あなたのエモカイを実際に呼んでみましょう！" : "Let’s call your Emokai into the world!"}
              </p>
              <div className="pt-2">
                <Link href={`/${locale}/ar`} className={primaryButtonClass}>
                  {summonLabel}
                </Link>
              </div>
            </section>
          </>
        )}

        {step === 15 && (
          <>
            <section className="space-y-4">
              <h2 className="text-base font-semibold text-textPrimary">
                {isJa ? "エモカイコレクション" : "Emokai collection"}
              </h2>
              {collection.length === 0 ? (
                <p className="text-sm text-textSecondary">{noCollectionText}</p>
              ) : (
                <div className="grid gap-3">
                {collection.map((entry) => {
                  const placeLabel = entry.placeOptionLabel ?? entry.placeDescription ?? "";
                  const placeDisplay = placeLabel || "—";
                  const emotionDisplay = entry.emotions.length ? entry.emotions.join(isJa ? " / " : ", ") : "—";

                  return (
                    <div key={entry.id} className="rounded-2xl border border-divider p-4 text-sm text-textSecondary">
                      <div className="mb-3 h-40 w-full rounded-xl bg-[rgba(237,241,241,0.06)]" />
                      <p className="font-semibold text-textPrimary">{entry.name}</p>
                      <p>{isJa ? `感情: ${emotionDisplay}` : `Emotion: ${emotionDisplay}`}</p>
                      <p>{isJa ? `場所: ${placeDisplay}` : `Place: ${placeDisplay}`}</p>
                      <p className="text-xs opacity-70">{formatDate(entry.createdAt, locale)}</p>
                    </div>
                  );
                })}
              </div>
              )}
              <div className="pt-2">
                <button type="button" className={secondaryButtonClass} onClick={() => router.push(next(1))}>
                  {createAnotherLabel}
                </button>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
