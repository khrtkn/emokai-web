"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Divider, Header, InstructionBanner, RichInput, ImageOption } from "@/components/ui";

type Props = { params: { locale: string; id: string } };

const MIN_TEXT_LENGTH = 10;
const PLACE_STORAGE_KEY = "emokai_place";
const REASON_STORAGE_KEY = "emokai_reason";
const EMOTIONS_STORAGE_KEY = "emokai_emotions";
const ACTION_STORAGE_KEY = "emokai_action";
const APPEARANCE_STORAGE_KEY = "emokai_appearance";
const PLACE_CHOICE_KEY = "emokai_place_choice";
const CHARACTER_CHOICE_KEY = "emokai_character_choice";

const PLACE_OPTIONS = [
  { id: "place-1", label: "都市の公園" },
  { id: "place-2", label: "静かな図書館" },
  { id: "place-3", label: "夜の海辺" },
  { id: "place-4", label: "山の神社" }
];

const CHARACTER_OPTIONS = [
  { id: "character-1", label: "柔らかな光" },
  { id: "character-2", label: "波紋の布" },
  { id: "character-3", label: "霧の翼" },
  { id: "character-4", label: "音の粒" }
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

function StepLabel({ text }: { text?: string }) {
  if (!text) return null;
  return <p className="text-xs text-textSecondary">{text}</p>;
}

function Section({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-textPrimary">{title}</h2>
      {children}
    </section>
  );
}

function PlaceholderImage({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[rgba(237,241,241,0.05)] text-xs text-textSecondary">
      {label}
    </div>
  );
}

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

export default function EmokaiStepPage({ params }: Props) {
  const { locale, id } = params;
  const router = useRouter();

  const rawStep = Number(id);
  const isStepValid = !Number.isNaN(rawStep) && rawStep >= 1 && rawStep <= 15;
  const step = useMemo(() => {
    if (Number.isNaN(rawStep)) return 1;
    return Math.min(Math.max(rawStep, 1), 15);
  }, [rawStep]);

  useEffect(() => {
    if (!isStepValid) {
      router.replace(`/${locale}/emokai/step/1`);
    }
  }, [isStepValid, locale, router]);

  const next = (n: number) => `/${locale}/emokai/step/${n}`;

  // Step4 state
  const [placeText, setPlaceText] = useState("");
  const [placeTouched, setPlaceTouched] = useState(false);

  useEffect(() => {
    if (step === 4) {
      const stored = loadSessionString(PLACE_STORAGE_KEY);
      setPlaceText(stored);
      if (stored.trim().length > 0) setPlaceTouched(true);
    }
  }, [step]);

  const placeValid = placeText.trim().length >= MIN_TEXT_LENGTH;

  const handlePlaceChange = (value: string) => {
    setPlaceTouched(true);
    setPlaceText(value);
    saveSessionString(PLACE_STORAGE_KEY, value);
  };

  const handleStep4Next = () => {
    if (!placeValid) {
      setPlaceTouched(true);
      return;
    }
    router.push(next(5));
  };

  // Step5 state
  const [reasonText, setReasonText] = useState("");
  const [reasonTouched, setReasonTouched] = useState(false);

  useEffect(() => {
    if (step === 5) {
      const stored = loadSessionString(REASON_STORAGE_KEY);
      setReasonText(stored);
      if (stored.trim().length > 0) setReasonTouched(true);
    }
  }, [step]);

  const reasonValid = reasonText.trim().length >= MIN_TEXT_LENGTH;

  const handleReasonChange = (value: string) => {
    setReasonTouched(true);
    setReasonText(value);
    saveSessionString(REASON_STORAGE_KEY, value);
  };

  const handleStep5Next = () => {
    if (!reasonValid) {
      setReasonTouched(true);
      return;
    }
    router.push(next(6));
  };

  // Step6 state
  const [placeChoice, setPlaceChoice] = useState<string | null>(null);
  const [placeChoiceError, setPlaceChoiceError] = useState(false);

  useEffect(() => {
    if (step === 6) {
      const stored = loadSessionString(PLACE_CHOICE_KEY, "");
      if (stored) {
        setPlaceChoice(stored);
      }
    }
  }, [step]);

  const handlePlaceSelect = (optionId: string) => {
    setPlaceChoice(optionId);
    setPlaceChoiceError(false);
    saveSessionString(PLACE_CHOICE_KEY, optionId);
  };

  const handleStep6Next = () => {
    if (!placeChoice) {
      setPlaceChoiceError(true);
      return;
    }
    router.push(next(7));
  };

  // Step7 state
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([]);
  const [emotionTouched, setEmotionTouched] = useState(false);

  useEffect(() => {
    if (step === 7) {
      const stored = loadSessionArray(EMOTIONS_STORAGE_KEY);
      if (stored.length > 0) {
        setSelectedEmotions(stored);
        setEmotionTouched(true);
      }
    }
  }, [step]);

  const emotionValid = selectedEmotions.length > 0;

  const toggleEmotion = (emotion: string) => {
    setEmotionTouched(true);
    setSelectedEmotions((prev) => {
      const exists = prev.includes(emotion);
      const nextList = exists ? prev.filter((item) => item !== emotion) : [...prev, emotion];
      saveSessionArray(EMOTIONS_STORAGE_KEY, nextList);
      return nextList;
    });
  };

  const handleStep7Next = () => {
    if (!emotionValid) {
      setEmotionTouched(true);
      return;
    }
    router.push(next(8));
  };

  // Step8 state
  const [actionText, setActionText] = useState("");
  const [actionTouched, setActionTouched] = useState(false);

  useEffect(() => {
    if (step === 8) {
      const stored = loadSessionString(ACTION_STORAGE_KEY);
      setActionText(stored);
      if (stored.trim().length > 0) setActionTouched(true);
    }
  }, [step]);

  const actionValid = actionText.trim().length >= MIN_TEXT_LENGTH;

  const handleActionChange = (value: string) => {
    setActionTouched(true);
    setActionText(value);
    saveSessionString(ACTION_STORAGE_KEY, value);
  };

  const handleStep8Next = () => {
    if (!actionValid) {
      setActionTouched(true);
      return;
    }
    router.push(next(9));
  };

  // Step9 state
  const [appearanceText, setAppearanceText] = useState("");
  const [appearanceTouched, setAppearanceTouched] = useState(false);

  useEffect(() => {
    if (step === 9) {
      const stored = loadSessionString(APPEARANCE_STORAGE_KEY);
      setAppearanceText(stored);
      if (stored.trim().length > 0) setAppearanceTouched(true);
    }
  }, [step]);

  const appearanceValid = appearanceText.trim().length >= MIN_TEXT_LENGTH;

  const handleAppearanceChange = (value: string) => {
    setAppearanceTouched(true);
    setAppearanceText(value);
    saveSessionString(APPEARANCE_STORAGE_KEY, value);
  };

  const handleStep9Next = () => {
    if (!appearanceValid) {
      setAppearanceTouched(true);
      return;
    }
    router.push(next(10));
  };

  // Step10 state
  const [characterChoice, setCharacterChoice] = useState<string | null>(null);
  const [characterChoiceError, setCharacterChoiceError] = useState(false);

  useEffect(() => {
    if (step === 10) {
      const stored = loadSessionString(CHARACTER_CHOICE_KEY, "");
      if (stored) {
        setCharacterChoice(stored);
      }
    }
  }, [step]);

  const handleCharacterSelect = (optionId: string) => {
    setCharacterChoice(optionId);
    setCharacterChoiceError(false);
    saveSessionString(CHARACTER_CHOICE_KEY, optionId);
  };

  const handleStep10Next = () => {
    if (!characterChoice) {
      setCharacterChoiceError(true);
      return;
    }
    router.push(next(11));
  };

  const pillClass = (selected: boolean) =>
    `rounded-full border px-3 py-2 text-xs transition ${
      selected
        ? "border-transparent bg-accent text-black"
        : "border-divider text-textSecondary hover:border-accent"
    }`;

  const linkButtonClass = "inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90";

  const secondaryButtonClass = "inline-block rounded-lg border border-divider px-4 py-2 text-sm text-textPrimary transition hover:border-accent";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-canvas">
      <Header title="EMOKAI" />
      <Divider />
      <div className="space-y-6 px-4 py-6 sm:px-6">
        {step === 1 && (
          <>
            <InstructionBanner tone="default">感情の妖怪を発見する旅へ</InstructionBanner>
            <Section title="EMOKAI">
              <p className="text-sm text-textSecondary">感情の妖怪を発見する旅へ</p>
              <div className="pt-4">
                <button type="button" className={linkButtonClass} onClick={() => router.push(next(2))}>
                  はじめる
                </button>
              </div>
            </Section>
          </>
        )}

        {step === 2 && (
          <>
            <StepLabel text="Step. 1/8" />
            <Section title="エモカイとは">
              <p className="text-sm text-textSecondary">
                あなたにとって、大切な場所を思い浮かべてください。なぜか忘れられない場所、気づくとそこにいる場所、なんとなく写真に撮った場所...
              </p>
              <div className="pt-4">
                <button type="button" className={linkButtonClass} onClick={() => router.push(next(3))}>
                  次へ
                </button>
              </div>
            </Section>
          </>
        )}

        {step === 3 && (
          <>
            <StepLabel text="Step. 2/8" />
            <Section title="大切な場所を思い浮かべる">
              <p className="text-sm text-textSecondary">目を瞑り、その場所を妄想で歩いてください...なにかが動くのを感じる...</p>
              <div className="pt-4">
                <button type="button" className={linkButtonClass} onClick={() => router.push(next(4))}>
                  次へ
                </button>
              </div>
            </Section>
          </>
        )}

        {step === 4 && (
          <>
            <StepLabel text="Step. 3/8" />
            <Section title="あなたの大切な場所">
              <p className="text-sm text-textSecondary">
                あなたにとって大切な場所について教えてください（地名、見えているもの、雰囲気など）
              </p>
              <RichInput
                label=""
                placeholder="都内の公園のベンチ、日当たりが心地よい..."
                value={placeText}
                onChange={handlePlaceChange}
                maxLength={300}
                helperText="10文字以上で入力してください"
                error={placeTouched && !placeValid ? "10文字以上で入力してください" : undefined}
              />
              <div className="pt-2">
                <button type="button" className={linkButtonClass} onClick={handleStep4Next}>
                  次へ
                </button>
              </div>
            </Section>
          </>
        )}

        {step === 5 && (
          <>
            <StepLabel text="Step. 4/8" />
            <Section title="場所への想い">
              <p className="text-sm text-textSecondary">その場所は、なぜあなたにとって大切なのですか？</p>
              <RichInput
                label=""
                placeholder="自由記述"
                value={reasonText}
                onChange={handleReasonChange}
                maxLength={300}
                helperText="10文字以上で入力してください"
                error={reasonTouched && !reasonValid ? "10文字以上で入力してください" : undefined}
              />
              <div className="pt-2">
                <button type="button" className={linkButtonClass} onClick={handleStep5Next}>
                  次へ
                </button>
              </div>
            </Section>
          </>
        )}

        {step === 6 && (
          <>
            <StepLabel text="Step. 5/8" />
            <Section title="イメージに合う場所">
              <p className="text-sm text-textSecondary">あなたのイメージに合う場所を選択してください。</p>
              <div className="grid gap-4 pt-2">
                {PLACE_OPTIONS.map((option) => (
                  <ImageOption
                    key={option.id}
                    id={option.id}
                    label={option.label}
                    image={<PlaceholderImage label={option.label} />}
                    selected={placeChoice === option.id}
                    onSelect={handlePlaceSelect}
                  />
                ))}
              </div>
              {placeChoiceError && <p className="text-xs text-[#ffb9b9]">1つ選択してください。</p>}
              <div className="pt-2">
                <button type="button" className={linkButtonClass} onClick={handleStep6Next}>
                  選択して次へ
                </button>
              </div>
            </Section>
          </>
        )}

        {step === 7 && (
          <>
            <StepLabel text="Step. 6/8" />
            <Section title="場所への感情">
              <p className="text-sm text-textSecondary">その場所に対して抱く感情を選択してください。</p>
              <div className="space-y-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-textSecondary">基本感情</p>
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
                  <p className="text-xs uppercase tracking-[0.2em] text-textSecondary">詳細感情</p>
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
              {emotionTouched && !emotionValid && <p className="text-xs text-[#ffb9b9]">最低1つ選択してください。</p>}
              <div className="pt-2">
                <button type="button" className={linkButtonClass} onClick={handleStep7Next}>
                  選択して次へ
                </button>
              </div>
            </Section>
          </>
        )}

        {step === 8 && (
          <>
            <StepLabel text="Step. 7/8" />
            <Section title="エモカイのアクション">
              <p className="text-sm text-textSecondary">あなたのエモカイはこの場所に来たあなたに、何をしますか？具体的なアクションを教えてください。</p>
              <RichInput
                label=""
                placeholder="自由記述"
                value={actionText}
                onChange={handleActionChange}
                maxLength={300}
                helperText="10文字以上で入力してください"
                error={actionTouched && !actionValid ? "10文字以上で入力してください" : undefined}
              />
              <div className="pt-2">
                <button type="button" className={linkButtonClass} onClick={handleStep8Next}>
                  次へ
                </button>
              </div>
            </Section>
          </>
        )}

        {step === 9 && (
          <>
            <StepLabel text="Step. 8/8" />
            <Section title="エモカイの姿">
              <p className="text-sm text-textSecondary">あなたのエモカイはどのような見た目なのでしょうか？</p>
              <p className="text-sm text-textSecondary">他にも思いつく特徴を教えてください。（動き、色、匂い、口癖など）</p>
              <RichInput
                label=""
                placeholder="自由記述"
                value={appearanceText}
                onChange={handleAppearanceChange}
                maxLength={300}
                helperText="10文字以上で入力してください"
                error={appearanceTouched && !appearanceValid ? "10文字以上で入力してください" : undefined}
              />
              <div className="pt-2">
                <button type="button" className={linkButtonClass} onClick={handleStep9Next}>
                  次へ
                </button>
              </div>
            </Section>
          </>
        )}

        {step === 10 && (
          <>
            <Section title="エモカイを選ぶ">
              <p className="text-sm text-textSecondary">あなたのイメージに合うエモカイを選択してください。</p>
              <div className="grid gap-4 pt-2">
                {CHARACTER_OPTIONS.map((option) => (
                  <ImageOption
                    key={option.id}
                    id={option.id}
                    label={option.label}
                    image={<PlaceholderImage label={option.label} />}
                    selected={characterChoice === option.id}
                    onSelect={handleCharacterSelect}
                  />
                ))}
              </div>
              {characterChoiceError && <p className="text-xs text-[#ffb9b9]">1つ選択してください。</p>}
              <div className="pt-2">
                <button type="button" className={linkButtonClass} onClick={handleStep10Next}>
                  選択して次へ
                </button>
              </div>
            </Section>
          </>
        )}

        {step === 11 && (
          <>
            <Section title="エモカイ生成中...">
              <p className="text-sm text-textSecondary">この場所に対する感情を、この場所に住まう感情の妖怪「エモカイ」へと昇華させていきます...</p>
              <p className="text-sm text-textSecondary">あなたの感情は今、はじめて質量を持ち、常世に現れ始めている...</p>
              <div className="pt-2">
                <button type="button" className={linkButtonClass} onClick={() => router.push(next(12))}>
                  次へ
                </button>
              </div>
            </Section>
          </>
        )}

        {step === 12 && (
          <>
            <Section title="新しいエモカイが発見されました！">
              <p className="text-sm text-textSecondary">エモカイが発見されました。データベースへ登録しています...</p>
              <div className="aspect-square w-full rounded-2xl border border-divider" />
              <div className="pt-2">
                <button type="button" className={linkButtonClass} onClick={() => router.push(next(13))}>
                  次へ
                </button>
              </div>
            </Section>
          </>
        )}

        {step === 13 && (
          <>
            <Section title="エモカイ詳細">
              <div className="space-y-2 text-sm text-textSecondary">
                <p>ナンバー: No. [番号]</p>
                <p>名前: *NAME* emokaiの名前をここに</p>
                <p>ホスト: *HOST* ホストの名前をここに</p>
                <p>感情: *EMOTION* [選択された感情]</p>
                <p>ストーリー: *STORY* emokaiの物語をここに記載する</p>
              </div>
              <div className="pt-2">
                <button type="button" className={linkButtonClass} onClick={() => router.push(next(14))}>
                  登録する
                </button>
              </div>
            </Section>
          </>
        )}

        {step === 14 && (
          <>
            <Section title="エモカイを呼び出す">
              <p className="text-sm text-textSecondary">あなたのエモカイを実際に呼んでみましょう！</p>
              <div className="pt-2">
                <Link href={`/${locale}/ar`} className={linkButtonClass}>
                  ARで召喚
                </Link>
              </div>
            </Section>
          </>
        )}

        {step === 15 && (
          <>
            <Section title="エモカイコレクション">
              <div className="grid gap-3">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="rounded-2xl border border-divider p-3 text-sm text-textSecondary">
                    <div className="mb-2 h-40 w-full rounded-xl bg-[rgba(237,241,241,0.06)]" />
                    <p>名前: サンプル{n}</p>
                    <p>感情: Joy</p>
                    <p>場所: 都内の公園</p>
                  </div>
                ))}
              </div>
              <div className="pt-2">
                <button type="button" className={secondaryButtonClass} onClick={() => router.push(next(1))}>
                  新しいエモカイを作る
                </button>
              </div>
            </Section>
          </>
        )}
      </div>
    </main>
  );
}
