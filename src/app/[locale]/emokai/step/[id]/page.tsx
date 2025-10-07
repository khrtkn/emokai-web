'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';

import {
  Button,
  Divider,
  Header,
  ImageOption,
  InstructionBanner,
  LoadingScreen,
  MessageBlock,
  ProgressBar,
  RichInput,
} from '@/components/ui';
import { moderateText } from '@/lib/moderation';
import type { ProcessedImage } from '@/lib/image';
import { createStageOptions, type StageOption } from '@/lib/stage-generation';
import { createCharacterOptions, type CharacterOption } from '@/lib/character-generation';
import {
  generateComposite,
  generateModel,
  generateStory,
  type CompositeResult,
  type ModelResult,
  type StoryResult,
} from '@/lib/generation-jobs';
import { trackEvent, trackError } from '@/lib/analytics';
import {
  CHARACTER_SELECTION_KEY,
  GENERATION_RESULTS_KEY,
  STAGE_SELECTION_KEY,
} from '@/lib/storage-keys';
import {
  acquireGenerationLock,
  isGenerationLocked,
  releaseGenerationLock,
} from '@/lib/session-lock';
import type { Locale } from '@/lib/i18n/messages';
import { listCreations, type CreationPayload } from '@/lib/persistence';
import { cacheImage, getCachedImage, base64ToBlob } from '@/lib/image-cache';
import { isLiveApisEnabled } from '@/lib/env/client';
import { getModelTargetFormats } from '@/lib/device';

const MIN_TEXT_LENGTH = 1;
const TOTAL_STEPS = 15;
const AR_SUMMON_STORAGE_KEY = 'emokai_ar_launched';

type EmotionGroup = {
  id: string;
  label: { en: string; ja: string };
  emotions: string[];
};

const EMOTION_LABELS_JA: Record<string, string> = {
  Ecstasy: '有頂天',
  Joy: '喜び',
  Serenity: '穏やかさ',
  Admiration: '賞賛',
  Trust: '信頼',
  Acceptance: '受容',
  Terror: '恐怖',
  Fear: '恐れ',
  Apprehension: '不安',
  Amazement: '驚嘆',
  Surprise: '驚き',
  Distraction: '戸惑い',
  Grief: '深い悲しみ',
  Sadness: '悲しみ',
  Pensiveness: '物思い',
  Loathing: '激しい嫌悪',
  Disgust: '嫌悪',
  Boredom: '退屈',
  Rage: '激怒',
  Anger: '怒り',
  Annoyance: '苛立ち',
  Vigilance: '警戒',
  Anticipation: '期待',
  Interest: '興味',
};

const EMOTION_GROUPS: EmotionGroup[] = [
  { id: 'joy', label: { en: 'Joy', ja: '喜び' }, emotions: ['Ecstasy', 'Joy', 'Serenity'] },
  {
    id: 'trust',
    label: { en: 'Trust', ja: '信頼' },
    emotions: ['Admiration', 'Trust', 'Acceptance'],
  },
  { id: 'fear', label: { en: 'Fear', ja: '恐れ' }, emotions: ['Terror', 'Fear', 'Apprehension'] },
  {
    id: 'surprise',
    label: { en: 'Surprise', ja: '驚き' },
    emotions: ['Amazement', 'Surprise', 'Distraction'],
  },
  {
    id: 'sadness',
    label: { en: 'Sadness', ja: '悲しみ' },
    emotions: ['Grief', 'Sadness', 'Pensiveness'],
  },
  {
    id: 'disgust',
    label: { en: 'Disgust', ja: '嫌悪' },
    emotions: ['Loathing', 'Disgust', 'Boredom'],
  },
  { id: 'anger', label: { en: 'Anger', ja: '怒り' }, emotions: ['Rage', 'Anger', 'Annoyance'] },
  {
    id: 'anticipation',
    label: { en: 'Anticipation', ja: '期待' },
    emotions: ['Vigilance', 'Anticipation', 'Interest'],
  },
];

const EMOTION_COLORS: Record<string, { solid: string; light: string; onSolid: string }> = {
  Ecstasy: { solid: '#B45309', light: '#F59E0B', onSolid: '#FFFBEB' },
  Joy: { solid: '#F59E0B', light: '#FCD34D', onSolid: '#1F2937' },
  Serenity: { solid: '#FEF3C7', light: '#FDE68A', onSolid: '#92400E' },
  Admiration: { solid: '#0F766E', light: '#2DD4BF', onSolid: '#ECFEFF' },
  Trust: { solid: '#14B8A6', light: '#5EEAD4', onSolid: '#022C22' },
  Acceptance: { solid: '#99F6E4', light: '#5EEAD4', onSolid: '#0F172A' },
  Terror: { solid: '#312E81', light: '#6366F1', onSolid: '#E0E7FF' },
  Fear: { solid: '#4338CA', light: '#818CF8', onSolid: '#E0E7FF' },
  Apprehension: { solid: '#A5B4FC', light: '#C7D2FE', onSolid: '#1E1B4B' },
  Amazement: { solid: '#1E3A8A', light: '#60A5FA', onSolid: '#DBEAFE' },
  Surprise: { solid: '#2563EB', light: '#60A5FA', onSolid: '#DBEAFE' },
  Distraction: { solid: '#93C5FD', light: '#BFDBFE', onSolid: '#1E3A8A' },
  Grief: { solid: '#1D4ED8', light: '#60A5FA', onSolid: '#EFF6FF' },
  Sadness: { solid: '#3B82F6', light: '#93C5FD', onSolid: '#EFF6FF' },
  Pensiveness: { solid: '#BFDBFE', light: '#DBEAFE', onSolid: '#1E3A8A' },
  Loathing: { solid: '#166534', light: '#34D399', onSolid: '#ECFDF5' },
  Disgust: { solid: '#15803D', light: '#4ADE80', onSolid: '#ECFDF5' },
  Boredom: { solid: '#BBF7D0', light: '#A7F3D0', onSolid: '#064E3B' },
  Rage: { solid: '#7F1D1D', light: '#F87171', onSolid: '#FEF2F2' },
  Anger: { solid: '#B91C1C', light: '#F87171', onSolid: '#FEF2F2' },
  Annoyance: { solid: '#FCA5A5', light: '#FECACA', onSolid: '#7F1D1D' },
  Vigilance: { solid: '#7C2D12', light: '#FB923C', onSolid: '#FFF7ED' },
  Anticipation: { solid: '#EA580C', light: '#FDBA74', onSolid: '#FFF7ED' },
  Interest: { solid: '#FED7AA', light: '#FDE68A', onSolid: '#7C2D12' },
};

const DEFAULT_EMOTION_COLORS = {
  solid: '#2563EB',
  light: '#60A5FA',
  onSolid: '#EFF6FF',
};

const emotionButtonClass =
  'rounded-full border px-3 py-2 text-xs transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

function formatCoordinates(lat: number, lng: number, isJa: boolean) {
  const latAbs = Math.abs(lat).toFixed(4);
  const lngAbs = Math.abs(lng).toFixed(4);
  const latDir = lat >= 0;
  const lngDir = lng >= 0;

  if (isJa) {
    const latLabel = latDir ? '北緯' : '南緯';
    const lngLabel = lngDir ? '東経' : '西経';
    return `${latLabel}${latAbs}° / ${lngLabel}${lngAbs}°`;
  }

  const latLabel = `${latAbs}°${latDir ? 'N' : 'S'}`;
  const lngLabel = `${lngAbs}°${lngDir ? 'E' : 'W'}`;
  return `${latLabel}, ${lngLabel}`;
}

function isCoordinateLabel(value: string) {
  const text = value.trim();
  if (!text) return false;
  const lower = text.toLowerCase();
  if (
    lower.includes('北緯') ||
    lower.includes('南緯') ||
    lower.includes('東経') ||
    lower.includes('西経')
  ) {
    return true;
  }
  return /^[-+]?\d+(\.\d+)?\s*,\s*[-+]?\d+(\.\d+)?$/.test(text);
}

type StageFlowStatus = 'idle' | 'moderating' | 'uploading' | 'generating' | 'ready' | 'error';
type CharacterFlowStatus = 'idle' | 'generating' | 'ready' | 'error';
type JobStatus = 'pending' | 'active' | 'complete' | 'error';

type GenerationResults = {
  model?: ModelResult;
  composite?: CompositeResult;
  story?: StoryResult;
};

type StoredGenerationPayload = {
  characterId: string;
  description: string;
  results: GenerationResults;
  completedAt: number | null;
};

type Props = { params: { locale: string; id: string } };

type StageSelectionPayload = {
  selectedId: string;
  selectedOption: StageOption;
  timestamp: number;
};

type StageReferenceHint = { description?: string; type?: 'streetview' | 'satellite' };

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
  'inline-block min-h-[44px] rounded-lg bg-accent px-6 text-sm font-semibold text-black transition hover:opacity-90';

function formatDate(value: string, locale: Locale) {
  try {
    return new Date(value).toLocaleString(locale === 'ja' ? 'ja-JP' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return value;
  }
}

function readStageSelection(): StageSelectionPayload | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(STAGE_SELECTION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StageSelectionPayload;
    if (parsed?.selectedOption?.id) {
      return parsed;
    }
  } catch (error) {
    console.warn('Failed to parse stage selection', error);
  }
  return null;
}

function persistStageSelection(option: StageOption) {
  if (typeof window === 'undefined') return;
  const payload: StageSelectionPayload = {
    selectedId: option.id,
    selectedOption: option,
    timestamp: Date.now(),
  };
  window.sessionStorage.setItem(STAGE_SELECTION_KEY, JSON.stringify(payload));
}

function readCharacterSelection(): CharacterSelectionPayload | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(CHARACTER_SELECTION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CharacterSelectionPayload;
    if (parsed?.selectedOption?.id) {
      return parsed;
    }
  } catch (error) {
    console.warn('Failed to parse character selection', error);
  }
  return null;
}

function persistCharacterSelection(option: CharacterOption, description: string) {
  if (typeof window === 'undefined') return;
  const payload: CharacterSelectionPayload = {
    selectedId: option.id,
    description,
    selectedOption: option,
    timestamp: Date.now(),
  };
  window.sessionStorage.setItem(CHARACTER_SELECTION_KEY, JSON.stringify(payload));
}

function readCharacterOptions(): CharacterOption[] {
  if (typeof window === 'undefined') return [];
  const raw = window.sessionStorage.getItem(CHARACTER_OPTIONS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as CharacterOption[];
    }
  } catch (error) {
    console.warn('Failed to parse character options', error);
  }
  return [];
}

function persistCharacterOptions(options: CharacterOption[]) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(CHARACTER_OPTIONS_KEY, JSON.stringify(options));
}

function clearCharacterOptions() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(CHARACTER_OPTIONS_KEY);
}

function readGenerationPayload(): StoredGenerationPayload | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(GENERATION_RESULTS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredGenerationPayload;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const results = { ...(parsed.results ?? {}) } as GenerationResults;
    const compositeOriginal = results.composite as CompositeResult | undefined;
    const composite = compositeOriginal ? { ...compositeOriginal } : undefined;

    if (composite) {
      const cached = composite.cacheKey ? getCachedImage(composite.cacheKey) : null;

      if (cached) {
        composite.url = cached.objectUrl ?? `data:${cached.mimeType};base64,${cached.base64}`;
      } else if (composite.imageBase64 && (!composite.url || !composite.url.startsWith('data:'))) {
        const mime = composite.mimeType || 'image/png';
        composite.url = `data:${mime};base64,${composite.imageBase64}`;
      } else if (
        composite.url &&
        !/^https?:/i.test(composite.url) &&
        !composite.url.startsWith('data:')
      ) {
        composite.url = '';
      }
    }

    const normalized: StoredGenerationPayload = {
      characterId: parsed.characterId ?? '',
      description: parsed.description ?? '',
      results: {
        ...results,
        ...(composite ? { composite } : {}),
      },
      completedAt: parsed.completedAt ?? null,
    };

    return normalized;
  } catch (error) {
    console.warn('Failed to parse generation payload', error);
  }
  return null;
}

function persistGenerationPayload(payload: StoredGenerationPayload) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(GENERATION_RESULTS_KEY, JSON.stringify(payload));
}

type GenerationState = {
  model: JobStatus;
  composite: JobStatus;
  story: JobStatus;
};

const INITIAL_GENERATION_STATE: GenerationState = {
  model: 'pending',
  composite: 'pending',
  story: 'pending',
};

const loadSessionString = (key: string, fallback = '') => {
  if (typeof window === 'undefined') return fallback;
  return window.sessionStorage.getItem(key) ?? fallback;
};

const saveSessionString = (key: string, value: string) => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(key, value);
};

const loadSessionArray = (key: string) => {
  if (typeof window === 'undefined') return [] as string[];
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
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(key, JSON.stringify(value));
};

const PLACE_STORAGE_KEY = 'emokai_place';
const REASON_STORAGE_KEY = 'emokai_reason';
const EMOTIONS_STORAGE_KEY = 'emokai_emotions';
const ACTION_STORAGE_KEY = 'emokai_action';
const APPEARANCE_STORAGE_KEY = 'emokai_appearance';
const CHARACTER_OPTIONS_KEY = 'emokai_character_options';

export default function EmokaiStepPage({ params }: Props) {
  const { locale, id } = params;
  const localeKey: Locale = locale === 'ja' ? 'ja' : 'en';
  const isJa = localeKey === 'ja';
  const router = useRouter();
  const liveApisEnabled = isLiveApisEnabled();

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

  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  const initialEmotions = useMemo(() => loadSessionArray(EMOTIONS_STORAGE_KEY), []);
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>(initialEmotions);
  const [emotionTouched, setEmotionTouched] = useState(initialEmotions.length > 0);
  const emotionValid = selectedEmotions.length > 0;
  const [streetViewDescription, setStreetViewDescription] = useState<string | null>(null);

  const storedStageSelection = useMemo(() => readStageSelection(), []);
  const [stageOptions, setStageOptions] = useState<StageOption[]>(
    storedStageSelection ? [storedStageSelection.selectedOption] : [],
  );
  const [stageSelection, setStageSelection] = useState<StageOption | null>(
    storedStageSelection?.selectedOption ?? null,
  );
  const [stageStatus, setStageStatus] = useState<StageFlowStatus>(
    storedStageSelection ? 'ready' : 'idle',
  );
  const [stageModerationError, setStageModerationError] = useState<string | null>(null);
  const [stageGenerationError, setStageGenerationError] = useState<string | null>(null);
  const [stageProcessedImage, setStageProcessedImage] = useState<ProcessedImage | null>(null);
  const [showStageAdjust, setShowStageAdjust] = useState(false);

  const storedCharacterSelection = useMemo(() => readCharacterSelection(), []);
  const storedCharacterOptions = useMemo(() => readCharacterOptions(), []);
  const [characterOptions, setCharacterOptions] = useState<CharacterOption[]>(
    storedCharacterOptions.length
      ? storedCharacterOptions
      : storedCharacterSelection
        ? [storedCharacterSelection.selectedOption]
        : [],
  );
  const [characterSelection, setCharacterSelection] = useState<CharacterOption | null>(
    storedCharacterSelection?.selectedOption ?? null,
  );
  const [characterStatus, setCharacterStatus] = useState<CharacterFlowStatus>(
    storedCharacterOptions.length ? 'ready' : storedCharacterSelection ? 'ready' : 'idle',
  );
  const [characterGenerationError, setCharacterGenerationError] = useState<string | null>(null);
  const [showCharacterAdjust, setShowCharacterAdjust] = useState(false);

  const storedGeneration = useMemo(() => readGenerationPayload(), []);
  const computeStatus = (result: unknown): JobStatus => (result ? 'complete' : 'pending');

  const initialGenerationState = storedGeneration
    ? {
        model: computeStatus(storedGeneration.results.model),
        composite: computeStatus(storedGeneration.results.composite),
        story: computeStatus(storedGeneration.results.story),
      }
    : INITIAL_GENERATION_STATE;

  const [generationState, setGenerationState] = useState<GenerationState>(initialGenerationState);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationRunning, setGenerationRunning] = useState(false);
  const [generationLockActive, setGenerationLockActive] = useState(isGenerationLocked());
  const [generationResults, setGenerationResults] = useState<StoredGenerationPayload | null>(
    storedGeneration,
  );

  const [creations, setCreations] = useState<CreationPayload[]>(() => listCreations());
  const initialSummonState = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.sessionStorage.getItem(AR_SUMMON_STORAGE_KEY) === 'true';
  }, []);
  const [hasSummoned, setHasSummoned] = useState(initialSummonState);

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

  // ====== やわらかトーンの定型文 ======
  const minLengthHint = isJa ? '何か入力してください' : 'Please enter at least one character.';
  const selectOneHint = isJa ? '少なくとも1つえらんでください' : 'Please select at least one.';
  const nextLabel = isJa ? 'つづける' : 'Continue';
  const summonLabel = isJa ? '呼び出す' : 'Summon';
  const stageLoadingTitle = isJa ? '景色を現像しています…' : 'Rendering the scenery';
  const stageLoadingMessage = isJa
    ? 'あなたの感情から場所を再構築しています。'
    : 'Gathering the atmosphere of the place you described.';
  const characterLoadingTitle = isJa ? 'あなたのエモカイを現像しています…' : 'Shaping your Emokai';
  const characterLoadingMessage = isJa
    ? '場所と感情からエモカイの姿を再構築しています。'
    : 'Letting your Emokai take form from your feelings.';
  const creationLoadingTitle = isJa ? 'エモカイを呼び出しています…' : 'Preparing your Emokai...';
  const creationLoadingMessage = isJa
    ? 'あなたのエモカイに関わる情報を調査しています。'
    : 'Combining scenery, companion, and story.';
  const getEmotionLabel = useCallback(
    (emotion: string) => (isJa ? EMOTION_LABELS_JA[emotion] ?? emotion : emotion),
    [isJa],
  );

  const stepLabelText = useMemo(() => {
    if (step >= 2 && step <= 9) {
      const index = step - 1;
      return `Step. ${index}/8`;
    }
    return undefined;
  }, [step]);

  const stageLocationReference = useMemo(() => {
    const trimmed = placeText.trim();
    if (geoCoords) {
      return `${geoCoords.lat.toFixed(6)}, ${geoCoords.lng.toFixed(6)}`;
    }
    if (trimmed && isCoordinateLabel(trimmed)) {
      return trimmed;
    }
    return null;
  }, [geoCoords, placeText]);

  const mapQuery = useMemo(() => {
    const trimmed = placeText.trim();
    if (trimmed && !isCoordinateLabel(trimmed)) {
      return trimmed;
    }
    if (geoCoords) {
      return `${geoCoords.lat},${geoCoords.lng}`;
    }
    return trimmed || null;
  }, [geoCoords, placeText]);

  const buildStagePrompt = useCallback(
    (reference?: StageReferenceHint) => {
      const lines: string[] = [];
      if (reasonText.trim()) {
        lines.push(
          localeKey === 'ja'
            ? `その感情を思い出させるエピソードを教えてください。: ${reasonText}`
            : `Why this spot matters: ${reasonText}`,
        );
      }
      lines.push(
        localeKey === 'ja' ? `場所の情景: ${placeText}` : `Scene description: ${placeText}`,
      );
      if (stageLocationReference) {
        lines.push(
          localeKey === 'ja'
            ? `位置の手がかり: ${stageLocationReference}`
            : `Location hint: ${stageLocationReference}`,
        );
      }
      const effectiveDescription = reference?.description ?? streetViewDescription;
      const imageryType = reference?.type ?? (streetViewDescription ? 'streetview' : undefined);
      if (effectiveDescription) {
        lines.push(
          localeKey === 'ja'
            ? imageryType === 'satellite'
              ? `参考画像メモ（上空視点）: ${effectiveDescription}`
              : `参考画像メモ（ストリートビュー）: ${effectiveDescription}`
            : imageryType === 'satellite'
              ? `Notes from overhead reference: ${effectiveDescription}`
              : `Notes from Street View reference: ${effectiveDescription}`,
        );
      }
      if (imageryType) {
        lines.push(
          imageryType === 'satellite'
            ? localeKey === 'ja'
              ? '参考: 上空視点の参考画像を添付しています。'
              : 'Reference: Overhead imagery is attached.'
            : localeKey === 'ja'
              ? '参考: Google Street View の画像を添付しています。'
              : 'Reference: Google Street View imagery is attached.',
        );
      }
      lines.push(
        localeKey === 'ja'
          ? '描写範囲: 上記の場所そのものと半径30mほどの周辺に集中し、都市全体や広域の俯瞰ではなく「その場所で目に入る景色」を写してください。'
          : 'Focus area: stay within the spot described above (roughly a 30m radius) and depict what someone standing there would see, not a broad citywide vista.',
      );
      if (reasonText.trim()) {
        lines.push(
          localeKey === 'ja'
            ? '上記の「この場所が特別な理由」を軸に、感情と結びついた視点や被写体を優先してください。'
            : 'Use the “why it matters” note above to guide the vantage point and atmosphere.',
        );
      }
      lines.push(
        localeKey === 'ja'
          ? '被写体は景色・建築・自然要素のみ。人物や動物、クルマ、文字などの生活主体は映さず、フォトリアルな質感で表現してください。'
          : 'Include only scenery, architecture, and natural elements—no people, animals, or vehicles—and render everything photorealistically.',
      );
      // 内部用プロンプト（UI文言には出さないが機能上は必要）
      lines.push(
        localeKey === 'ja'
          ? 'フォトリアルな背景のみの画像を2枚生成してください。人物は含めないでください。'
          : 'Generate two photorealistic background-only images (no people).',
      );
      return lines.join('\n');
    },
    [localeKey, placeText, reasonText, stageLocationReference, streetViewDescription],
  );

  const characterPrompt = useMemo(() => {
    const lines: string[] = [];
    lines.push(
      localeKey === 'ja'
        ? '以下の情報をもとに、独創的な感情の妖怪『エモカイ』の外見イメージをつくってください。'
        : 'Using the following details, create visual ideas for the 妖怪 pf emotion.',
    );
    lines.push(localeKey === 'ja' ? `場所: ${placeText}` : `Place: ${placeText}`);
    lines.push(
      localeKey === 'ja' ? `この場所が大切な理由: ${reasonText}` : `Why it matters: ${reasonText}`,
    );
    lines.push(
      localeKey === 'ja' ? `エモカイのふるまい: ${actionText}` : `Emokai's action: ${actionText}`,
    );
    lines.push(
      localeKey === 'ja' ? `見た目の手がかり: ${appearanceText}` : `Appearance: ${appearanceText}`,
    );
    lines.push(
      localeKey === 'ja'
        ? '上記の内容を3Dモデルレンダリング風の画像プロンプトへ変換し、キャラクターを正面から描写してください。背景は完全な白 (純白) とし、余計な要素を配置しないでください。スタジオの柔らかい照明で、被写体が均一に照らされるようにしてください。'
        : 'Convert the above into an image prompt for a 3D model render of the character from the front. Use a pure white background with no other elements, and light it with soft studio lighting for even illumination.',
    );
    return lines.join('\n');
  }, [localeKey, placeText, reasonText, selectedEmotions, actionText, appearanceText]);

  const storyPrompt = useMemo(() => {
    if (localeKey === 'ja') {
      return `あなたは感情の妖怪『エモカイ』の語り部です。以下の情報をもとに、日本語で300文字程度の伝承を作成してください。\n\n場所: ${placeText}\n大切な理由: ${reasonText}\n抱く気持ち: ${selectedEmotions.join('、') || '不明'}\nふるまい: ${actionText}\n見た目: ${appearanceText}`;
    }
    return `You are the storyteller of an Emokai. Write ~300 chars.\n\nPlace: ${placeText}\nWhy it matters: ${reasonText}\nEmotions: ${selectedEmotions.join(', ') || 'Unknown'}\nAction: ${actionText}\nAppearance: ${appearanceText}`;
  }, [localeKey, placeText, reasonText, selectedEmotions, actionText, appearanceText]);

  const handlePlaceChange = (value: string) => {
    setPlaceTouched(true);
    setPlaceText(value);
    saveSessionString(PLACE_STORAGE_KEY, value);
    setStageGenerationError(null);
    setStreetViewDescription(null);
  };

  const handleReasonChange = (value: string) => {
    setReasonTouched(true);
    setReasonText(value);
    saveSessionString(REASON_STORAGE_KEY, value);
    setStageGenerationError(null);
  };

  const handleActionChange = (value: string) => {
    setActionTouched(true);
    setActionText(value);
    saveSessionString(ACTION_STORAGE_KEY, value);
    setCharacterStatus('idle');
    setCharacterOptions([]);
    setCharacterSelection(null);
    setCharacterStatus('idle');
    clearCharacterOptions();
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(CHARACTER_SELECTION_KEY);
    }
  };

  const handleAppearanceChange = (value: string) => {
    setAppearanceTouched(true);
    setAppearanceText(value);
    saveSessionString(APPEARANCE_STORAGE_KEY, value);
    setCharacterGenerationError(null);
    setCharacterStatus('idle');
    setCharacterOptions([]);
    setCharacterSelection(null);
    clearCharacterOptions();
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(CHARACTER_SELECTION_KEY);
    }
  };

  const requestGeolocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoStatus('error');
      setGeoError(isJa ? '位置情報が利用できません。' : 'Location services unavailable.');
      return;
    }
    setGeoStatus('loading');
    setGeoError(null);
    setStreetViewDescription(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setGeoCoords({ lat: latitude, lng: longitude });
        setGeoStatus('success');
      },
      (error) => {
        console.warn('Geolocation error', error);
        setGeoStatus('error');
        setGeoError(
          error.message ||
            (isJa ? '位置情報を取得できませんでした。' : 'Failed to fetch your location.'),
        );
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }, [isJa]);

  const fetchStaticMapReference = useCallback(async (): Promise<ProcessedImage | null> => {
    if (!liveApisEnabled) return null;
    const center = geoCoords
      ? `${geoCoords.lat.toFixed(6)},${geoCoords.lng.toFixed(6)}`
      : mapQuery || null;
    if (!center) return null;
    try {
      const params = new URLSearchParams({
        center,
        maptype: 'satellite',
        zoom: '16',
        scale: '2',
      });
      const response = await fetch(`/api/maps/static?${params.toString()}`);
      if (!response.ok) {
        return null;
      }
      const data = (await response.json()) as { base64?: string; mimeType?: string };
      if (!data?.base64) {
        return null;
      }
      const blob = base64ToBlob(data.base64, data.mimeType ?? 'image/png');
      const webpUrl = URL.createObjectURL(blob);
      return {
        blob,
        webpUrl,
        size: blob.size,
      };
    } catch (error) {
      console.error('Failed to fetch static map', error);
      return null;
    }
  }, [geoCoords, mapQuery, liveApisEnabled]);

  const fetchStreetViewReference = useCallback(async (): Promise<{
    image: ProcessedImage;
    description?: string;
  } | null> => {
    if (!liveApisEnabled) return null;
    if (!geoCoords) return null;
    try {
      const params = new URLSearchParams({
        lat: geoCoords.lat.toString(),
        lng: geoCoords.lng.toString(),
      });
      const response = await fetch(`/api/maps/streetview?${params.toString()}`);
      if (!response.ok) {
        return null;
      }
      const data = (await response.json()) as {
        base64?: string;
        mimeType?: string;
        metadata?: { description?: string };
      };
      if (!data?.base64) {
        return null;
      }
      const blob = base64ToBlob(data.base64, data.mimeType ?? 'image/jpeg');
      const webpUrl = URL.createObjectURL(blob);
      return {
        image: {
          blob,
          webpUrl,
          size: blob.size,
        },
        description: data.metadata?.description ?? undefined,
      };
    } catch (error) {
      console.error('Failed to fetch Street View reference', error);
      setStreetViewDescription(null);
      return null;
    }
  }, [geoCoords, liveApisEnabled]);

  const toggleEmotion = (emotion: string) => {
    setEmotionTouched(true);
    setSelectedEmotions((prev) => {
      const exists = prev.includes(emotion);
      const nextList = exists ? prev.filter((item) => item !== emotion) : [...prev, emotion];
      saveSessionArray(EMOTIONS_STORAGE_KEY, nextList);
      setCharacterStatus('idle');
      setCharacterOptions([]);
      setCharacterSelection(null);
      clearCharacterOptions();
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(CHARACTER_SELECTION_KEY);
      }
      return nextList;
    });
  };

  const stageDescriptionReady = placeText.trim().length >= MIN_TEXT_LENGTH;

  const runStageGeneration = async ({
    processedImage = null,
    trackLabel,
    autoSelect = false,
    referenceHint,
    promptOverride,
  }: {
    processedImage?: ProcessedImage | null;
    trackLabel: string;
    autoSelect?: boolean;
    referenceHint?: StageReferenceHint;
    promptOverride?: string;
  }): Promise<boolean> => {
    setStageStatus('generating');
    setStageModerationError(null);
    setStageGenerationError(null);
    setStageOptions([]);
    setStageSelection(null);
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(STAGE_SELECTION_KEY);
    }

    setCharacterOptions([]);
    setCharacterSelection(null);
    clearCharacterOptions();
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(CHARACTER_SELECTION_KEY);
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

    trackEvent('generation_start', { step: trackLabel, locale });

    try {
      const prompt = promptOverride ?? buildStagePrompt(referenceHint);
      const moderation = await moderateText(prompt, localeKey);
      if (!moderation.allowed) {
        setStageGenerationError(
          moderation.reason ??
            (isJa ? 'まだ形になりません。言葉を見直してみましょう。' : 'Content not allowed.'),
        );
        setStageStatus('error');
        return false;
      }

      const generated = await createStageOptions(prompt, processedImage ?? null);
      setStageOptions(generated);
      setStageStatus('ready');
      if (generated.length && autoSelect) {
        const first = generated[0];
        setStageSelection(first);
        persistStageSelection(first);
      }
      trackEvent('generation_complete', { step: trackLabel, locale });
      return true;
    } catch (error) {
      console.error(error);
      setStageGenerationError(
        isJa ? 'うまくいきませんでした。もう一度ためしてください。' : 'Failed to prepare scenery.',
      );
      setStageStatus('error');
      trackError(trackLabel, error);
      return false;
    }
  };

  const runCharacterGeneration = async (trackLabel: string): Promise<boolean> => {
    setCharacterStatus('generating');
    setCharacterGenerationError(null);
    setCharacterOptions([]);
    setCharacterSelection(null);
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(CHARACTER_SELECTION_KEY);
    }
    clearCharacterOptions();

    trackEvent('generation_start', { step: trackLabel, locale });

    try {
      const moderation = await moderateText(characterPrompt, localeKey);
      if (!moderation.allowed) {
        setCharacterGenerationError(
          moderation.reason ??
            (isJa ? 'まだ形になりません。言葉を見直してみましょう。' : 'Content not allowed.'),
        );
        setCharacterStatus('error');
        return false;
      }

      const generated = await createCharacterOptions(characterPrompt);
      setCharacterOptions(generated);
      setCharacterStatus('ready');
      persistCharacterOptions(generated);
      trackEvent('generation_complete', { step: trackLabel, locale });
      return true;
    } catch (error) {
      console.error(error);
      setCharacterGenerationError(
        isJa ? 'うまくいきませんでした。もう一度ためしてください。' : 'Failed to prepare options.',
      );
      setCharacterStatus('error');
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
    let referenceImage: ProcessedImage | null = null;
    let referenceHint: StageReferenceHint | undefined;

    const staticImage = await fetchStaticMapReference();
    if (staticImage) {
      referenceImage = staticImage;
      const description = (() => {
        if (mapQuery) {
          return isJa
            ? `${mapQuery} 周辺を上空から見た際の地形と配置`
            : `Overhead layout and landmarks around ${mapQuery}`;
        }
        if (stageLocationReference) {
          return isJa
            ? `座標 ${stageLocationReference} 付近の俯瞰イメージ`
            : `Overhead sense near coordinates ${stageLocationReference}`;
        }
        return undefined;
      })();
      referenceHint = {
        description,
        type: 'satellite',
      };
      setStreetViewDescription(null);
    } else if (geoCoords) {
      const result = await fetchStreetViewReference();
      if (result) {
        referenceImage = result.image;
        referenceHint = {
          description: result.description,
          type: 'streetview',
        };
        setStreetViewDescription(result.description ?? null);
      } else {
        setStreetViewDescription(null);
      }
    }

    const prompt = buildStagePrompt(referenceHint);

    await runStageGeneration({
      processedImage: referenceImage,
      trackLabel: 'stage_auto',
      autoSelect: true,
      promptOverride: prompt,
      referenceHint,
    });
    router.push(`/${locale}/emokai/step/7`);
  };

  const handleProceedToCharacterStep = async () => {
    if (characterStatus === 'generating') return;

    if (!appearanceValid) {
      setAppearanceTouched(true);
      return;
    }

    if (!stageSelection) {
      setCharacterGenerationError(
        isJa ? '先に景色をえらんでください。' : 'Please choose your scenery first.',
      );
      return;
    }

    if (characterPrompt.trim().length < MIN_TEXT_LENGTH) {
      setAppearanceTouched(true);
      setCharacterGenerationError(
        isJa ? 'まだ形になりません。もう少し書いてみましょう。' : 'Too short.',
      );
      return;
    }

    setCharacterGenerationError(null);
    const success = await runCharacterGeneration('character_options_initial');
    if (success) {
      router.push(`/${locale}/emokai/step/10`);
    }
  };

  const handleStageGenerateFromText = async () => {
    const reasonReady = reasonText.trim().length >= MIN_TEXT_LENGTH;
    if (!stageDescriptionReady) {
      setPlaceTouched(true);
    }
    if (!reasonReady) {
      setReasonTouched(true);
    }
    if (!stageDescriptionReady || !reasonReady) {
      setStageGenerationError(
        isJa
          ? 'もう少しだけ、その場所を教えてください。'
          : 'Tell us a little more about this place first.',
      );
      return false;
    }
    const success = await runStageGeneration({
      processedImage: null,
      trackLabel: 'stage_text_regen',
      promptOverride: buildStagePrompt(),
    });
    return success;
  };

  const stageSelectionFromOptions = (id: string) =>
    stageOptions.find((option) => option.id === id) ?? null;

  const handleStageSelect = (id: string) => {
    const option = stageSelectionFromOptions(id);
    if (!option) return;
    setStageSelection(option);
    persistStageSelection(option);
    setCharacterOptions([]);
    setCharacterSelection(null);
    setCharacterStatus('idle');
    clearCharacterOptions();
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(CHARACTER_SELECTION_KEY);
    }
  };

  const handleStageNext = () => {
    if (!stageSelection) {
      setStageGenerationError(
        isJa ? 'まだ決まっていません。ひとつ選んでください。' : 'Please choose one scenery.',
      );
      return;
    }
    setShowStageAdjust(false);
    router.push(`/${locale}/emokai/step/8`);
  };

  const handleStageApplyAdjust = async () => {
    const success = await handleStageGenerateFromText();
    if (success) {
      setShowStageAdjust(false);
    }
  };

  const handleArSummon = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(AR_SUMMON_STORAGE_KEY, 'true');
    }
    setHasSummoned(true);
    router.push(`/${locale}/ar`);
  }, [locale, router]);

  const handleSummonContinue = useCallback(() => {
    router.push(`/${locale}/emokai/step/15`);
  }, [locale, router]);

  const handleSendOff = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(AR_SUMMON_STORAGE_KEY);
    }
    setHasSummoned(false);
    router.push(`/${locale}/gallery`);
  }, [locale, router]);

  const handleCharacterRegenerate = async () => {
    if (characterPrompt.trim().length < MIN_TEXT_LENGTH) {
      setCharacterGenerationError(
        isJa ? 'まだ形になりません。もう少し書いてみましょう。' : 'Too short.',
      );
      return false;
    }
    const success = await runCharacterGeneration('character_options_regen');
    return success;
  };

  const handleCharacterSelect = (id: string) => {
    const option = characterOptions.find((item) => item.id === id);
    if (!option) return;
    setCharacterSelection(option);
    persistCharacterSelection(option, characterPrompt);
  };

  const handleCharacterNext = () => {
    if (!characterSelection) {
      setCharacterGenerationError(
        isJa ? 'まだ出会えていません。ひとつ選んでみましょう。' : 'Please choose one.',
      );
      return;
    }
    setShowCharacterAdjust(false);
    router.push(`/${locale}/emokai/step/11`);
  };

  const handleCharacterApplyAdjust = async () => {
    const success = await handleCharacterRegenerate();
    if (success) {
      setShowCharacterAdjust(false);
    }
  };

  const startGenerationJobs = async () => {
    if (!stageSelection || !characterSelection) {
      setGenerationError(isJa ? 'まだ準備がととのっていません。' : 'Not ready yet.');
      setGenerationState((prev) => ({
        ...prev,
        model: 'error',
        composite: 'error',
        story: 'error',
      }));
      return;
    }

    const lockAcquired = acquireGenerationLock();
    if (!lockAcquired) {
      setGenerationLockActive(true);
      setGenerationError(
        isJa ? 'いま別の用意をしています。' : 'Another preparation is in progress.',
      );
      return;
    }

    setGenerationLockActive(true);
    setGenerationRunning(true);
    setGenerationError(null);
    setGenerationState({ model: 'active', composite: 'active', story: 'active' });
    trackEvent('generation_start', { step: 'jobs_step11', locale });

    const stageCacheEntry = getCachedImage(stageSelection.cacheKey);
    if (!stageCacheEntry) {
      setGenerationError(isJa ? '景色の記録が見当たりません。' : 'Background data missing.');
      releaseGenerationLock();
      setGenerationLockActive(false);
      setGenerationRunning(false);
      return;
    }

    const characterCacheEntry = getCachedImage(characterSelection.cacheKey);
    if (!characterCacheEntry) {
      setGenerationError(isJa ? 'エモカイの記録が見当たりません。' : 'Character data missing.');
      releaseGenerationLock();
      setGenerationLockActive(false);
      setGenerationRunning(false);
      return;
    }

    const stageInput = {
      cacheKey: stageSelection.cacheKey,
      imageBase64: stageCacheEntry.base64,
      mimeType: stageCacheEntry.mimeType,
    };
    const characterInput = {
      cacheKey: characterSelection.cacheKey,
      imageBase64: characterCacheEntry.base64,
      mimeType: characterCacheEntry.mimeType,
    };

    const initialPayload: StoredGenerationPayload = {
      characterId: characterSelection.id,
      description: characterPrompt,
      results: {},
      completedAt: null,
    };
    setGenerationResults(initialPayload);
    persistGenerationPayload(initialPayload);

    const mergeResults = (partial: Partial<GenerationResults>) => {
      setGenerationResults((prev) => {
        const base = prev ?? initialPayload;
        const nextResults: GenerationResults = { ...base.results };

        if (partial.model) {
          nextResults.model = partial.model;
        }

        if (partial.story) {
          nextResults.story = partial.story;
        }

        if (partial.composite) {
          const incoming = partial.composite;
          const cacheKey = incoming.cacheKey ?? `composite-${characterSelection.id}`;

          let derivedUrl = incoming.url;

          if (incoming.imageBase64) {
            try {
              derivedUrl = cacheImage(cacheKey, incoming.imageBase64, incoming.mimeType);
            } catch (error) {
              console.warn('Failed to cache composite image', error);
            }
          } else {
            const cached = getCachedImage(cacheKey);
            if (cached) {
              derivedUrl = cached.objectUrl ?? `data:${cached.mimeType};base64,${cached.base64}`;
            }
          }

          const normalizedComposite: CompositeResult = {
            ...incoming,
            cacheKey,
            url: derivedUrl ?? incoming.url,
          };

          if (incoming.imageBase64 && liveApisEnabled) {
            normalizedComposite.imageBase64 = undefined;
          }

          nextResults.composite = normalizedComposite;
        }

        const nextPayload: StoredGenerationPayload = {
          characterId: base.characterId || characterSelection.id,
          description: characterPrompt,
          results: nextResults,
          completedAt: base.completedAt,
        };

        persistGenerationPayload(nextPayload);
        return nextPayload;
      });
    };

    const modelErrorMessage = isJa
      ? '3Dモデルの準備に失敗しました。あとでもう一度ためしてください。'
      : 'We could not prepare the 3D model. Please try again later.';
    const compositeErrorMessage = isJa
      ? '合成画像の生成に失敗しました。'
      : 'Failed to generate the composite image.';
    const storyErrorMessage = isJa ? '物語の生成に失敗しました。' : 'Failed to generate the story.';

    const modelPromise = generateModel({
      characterId: characterSelection.id,
      description: characterPrompt,
      characterImage: characterInput,
      targetFormats: getModelTargetFormats(),
    })
      .then((model) => {
        setGenerationState((prev) => ({ ...prev, model: 'complete' }));
        mergeResults({ model });
        return model;
      })
      .catch((error) => {
        console.error(error);
        setGenerationState((prev) => ({ ...prev, model: 'error' }));
        setGenerationError((prev) => prev ?? modelErrorMessage);
        trackError('jobs_step11_model', error);
        return null;
      });

    const compositeInstruction = isJa
      ? [
          '背景画像の中央から少し手前にキャラクターを配置してください。',
          '背景の光源方向と強さに合わせて、キャラクターの明るさやカラーを馴染ませます。',
          '足元に柔らかい影を落とし、地面と自然につながるようにしてください。',
          actionText.trim()
            ? `キャラクターのふるまい: ${actionText.trim()} を反映させたポーズや雰囲気にしてください。`
            : undefined,
        ]
          .filter(Boolean)
          .join('\n')
      : [
          'Place the character slightly in front of the center of the background.',
          'Match lighting direction and intensity so the character blends naturally with the scene.',
          'Add a soft contact shadow at the character’s feet to anchor them to the ground.',
          actionText.trim()
            ? `Incorporate this behavior into the pose or mood: ${actionText.trim()}`
            : undefined,
        ]
          .filter(Boolean)
          .join('\n');

    const compositePromise = generateComposite(stageInput, characterInput, compositeInstruction)
      .then((composite) => {
        setGenerationState((prev) => ({ ...prev, composite: 'complete' }));
        mergeResults({ composite });
        return composite;
      })
      .catch((error) => {
        console.error(error);
        setGenerationState((prev) => ({ ...prev, composite: 'error' }));
        setGenerationError((prev) => prev ?? compositeErrorMessage);
        trackError('jobs_step11_composite', error);
        return null;
      });

    const storyPromise = generateStory(storyPrompt, localeKey)
      .then((story) => {
        setGenerationState((prev) => ({ ...prev, story: 'complete' }));
        mergeResults({ story });
        return story;
      })
      .catch((error) => {
        console.error(error);
        setGenerationState((prev) => ({ ...prev, story: 'error' }));
        setGenerationError((prev) => prev ?? storyErrorMessage);
        trackError('jobs_step11_story', error);
        return null;
      });

    try {
      const [modelResult, compositeResult, storyResult] = await Promise.all([
        modelPromise,
        compositePromise,
        storyPromise,
      ]);

      if (modelResult && compositeResult && storyResult) {
        setGenerationResults((prev) => {
          if (!prev) return prev;
          const next = { ...prev, completedAt: Date.now() };
          persistGenerationPayload(next);
          return next;
        });
        trackEvent('generation_complete', { step: 'jobs_step11', locale });
      }
    } catch (error) {
      console.error(error);
      setGenerationError(
        (prev) =>
          prev ??
          (isJa ? 'うまくいきませんでした。もう一度ためしてください。' : 'Something went wrong.'),
      );
      trackError('jobs_step11', error);
    } finally {
      releaseGenerationLock();
      setGenerationLockActive(false);
      setGenerationRunning(false);
    }
  };

  const handleGenerationRetry = useCallback(() => {
    if (generationRunning) return;
    setGenerationError(null);
    setGenerationState(INITIAL_GENERATION_STATE);
    setGenerationResults(null);
    startGenerationJobs();
  }, [generationRunning, startGenerationJobs]);

  const handleGenerationSkip = useCallback(() => {
    setGenerationError(null);
    router.push(`/${locale}/emokai/step/12`);
  }, [locale, router]);

  useEffect(() => {
    if (step !== 11) return;
    if (generationRunning) return;
    if (generationResults) return;
    startGenerationJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const progressStages = useMemo(
    () => [
      { id: 'model', label: isJa ? 'すがた' : 'Model', status: generationState.model },
      {
        id: 'composite',
        label: isJa ? '景色と重ねる' : 'Composite',
        status: generationState.composite,
      },
      { id: 'story', label: isJa ? '物語' : 'Story', status: generationState.story },
    ],
    [generationState, isJa],
  );

  const compositeReady =
    generationState.composite === 'complete' && !!generationResults?.results?.composite;
  const storyReady = generationState.story === 'complete' && !!generationResults?.results?.story;
  const modelReady = generationState.model === 'complete' && !!generationResults?.results?.model;
  const allReady = compositeReady && storyReady && modelReady;

  const modelFailed = generationState.model === 'error';
  const compositeFailed = generationState.composite === 'error';
  const storyFailed = generationState.story === 'error';
  const hasGenerationFailure = modelFailed || compositeFailed || storyFailed;

  const mapEmbedUrl = useMemo(() => {
    if (!mapQuery) return null;
    return `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=16&t=k&output=embed`;
  }, [mapQuery]);

  // ====== 画面パーツ ======

  const renderStageStep = () => {
    if (stageStatus === 'generating') {
      return (
        <LoadingScreen
          visible
          variant="stage"
          title={stageLoadingTitle}
          message={stageLoadingMessage}
          mode="page"
        />
      );
    }

    return (
      <section className="space-y-4">
        <StepLabel text={stepLabelText} />
        <h2 className="text-base font-semibold text-textPrimary">
          {isJa ? '景色をえらぶ' : 'Choose the scenery'}
        </h2>
        <div className="grid gap-4">
          {stageOptions.map((option) => (
            <ImageOption
              key={option.id}
              id={option.id}
              selected={stageSelection?.id === option.id}
              onSelect={handleStageSelect}
              label={isJa ? 'これにする' : 'Choose this'}
              image={
                <img
                  src={option.previewUrl}
                  alt={isJa ? '景色' : 'Scenery'}
                  className="h-full w-full object-cover"
                />
              }
            />
          ))}
        </div>
        {!stageOptions.length ? (
          <p className="text-xs text-textSecondary">
            {isJa
              ? '調整すると、あたらしい景色があらわれます。'
              : 'Adjust the description to refresh the scenery.'}
          </p>
        ) : null}
        {stageGenerationError && !showStageAdjust ? (
          <p className="text-xs text-[#ffb9b9]">{stageGenerationError}</p>
        ) : null}
        <div className="flex gap-3 pt-2">
          <Button type="button" disabled={!stageSelection} onClick={handleStageNext}>
            {isJa ? '次へ進む' : 'Next'}
          </Button>
          <button
            type="button"
            className="rounded-lg border border-divider px-4 py-2 text-sm text-textSecondary transition hover:border-accent"
            onClick={() => setShowStageAdjust((prev) => !prev)}
          >
            {isJa ? '調整する' : 'Adjust'}
          </button>
        </div>
        {showStageAdjust ? (
          <div className="space-y-3 rounded-2xl border border-divider bg-[rgba(237,241,241,0.04)] p-4">
            <p className="text-xs text-textSecondary">
              {isJa
                ? 'ことばを手直しすると、景色の表情が変わります。'
                : 'Tweak the description to reshape the scenery.'}
            </p>
            <RichInput
              label=""
              placeholder={
                isJa
                  ? '木陰のベンチ。あたたかいひかりと、土と草の匂い…'
                  : 'A bench beneath trees, warm light, the smell of earth...'
              }
              value={placeText}
              onChange={handlePlaceChange}
              maxLength={300}
              helperText={minLengthHint}
              error={placeTouched && !placeValid ? minLengthHint : undefined}
            />
            <RichInput
              label=""
              placeholder={isJa ? 'なぜその場所が大切なのか…' : 'Why this place matters...'}
              value={reasonText}
              onChange={handleReasonChange}
              maxLength={300}
              helperText={minLengthHint}
              error={
                reasonTouched && reasonText.trim().length < MIN_TEXT_LENGTH
                  ? minLengthHint
                  : undefined
              }
            />
            {stageGenerationError ? (
              <p className="text-xs text-[#ffb9b9]">{stageGenerationError}</p>
            ) : null}
            <div className="flex gap-3">
              <Button type="button" onClick={handleStageApplyAdjust}>
                {isJa ? '反映する' : 'Apply'}
              </Button>
              <button
                type="button"
                className="rounded-lg border border-divider px-4 py-2 text-sm text-textSecondary transition hover:border-accent"
                onClick={() => setShowStageAdjust(false)}
              >
                {isJa ? '閉じる' : 'Close'}
              </button>
            </div>
          </div>
        ) : null}
      </section>
    );
  };

  const renderCharacterStep = () => {
    if (characterStatus === 'generating') {
      return (
        <LoadingScreen
          visible
          variant="character"
          title={characterLoadingTitle}
          message={characterLoadingMessage}
          mode="page"
        />
      );
    }

    return (
      <section className="space-y-4">
        <StepLabel text={stepLabelText} />
        <h2 className="text-base font-semibold text-textPrimary">
          {isJa ? '出会ったエモカイ' : 'Meet your Emokai'}
        </h2>
        <div className="grid gap-4">
          {characterOptions.map((option) => (
            <ImageOption
              key={option.id}
              id={option.id}
              selected={characterSelection?.id === option.id}
              onSelect={handleCharacterSelect}
              label={isJa ? 'これにする' : 'Choose this'}
              image={
                <img
                  src={option.previewUrl}
                  alt={isJa ? 'エモカイ' : 'Emokai'}
                  className="h-full w-full object-cover"
                />
              }
            />
          ))}
        </div>
        {characterGenerationError && !showCharacterAdjust ? (
          <p className="text-xs text-[#ffb9b9]">{characterGenerationError}</p>
        ) : null}
        <div className="flex gap-3 pt-2">
          <Button type="button" onClick={handleCharacterNext} disabled={!characterSelection}>
            {isJa ? '次へ進む' : 'Next'}
          </Button>
          <button
            type="button"
            className="rounded-lg border border-divider px-4 py-2 text-sm text-textSecondary transition hover:border-accent"
            onClick={() => setShowCharacterAdjust((prev) => !prev)}
          >
            {isJa ? '調整する' : 'Adjust'}
          </button>
        </div>
        {showCharacterAdjust ? (
          <div className="space-y-3 rounded-2xl border border-divider bg-[rgba(237,241,241,0.04)] p-4">
            <p className="text-xs text-textSecondary">
              {isJa
                ? '気になるところがあれば書き直して、あらためて呼び出せます。'
                : 'Tweak the description to regenerate new companions.'}
            </p>
            <RichInput
              label=""
              placeholder={
                isJa
                  ? '薄い水色で半透明。胸に小さな灯。歩くと鈴の音…'
                  : 'Pale blue and translucent; a small light in its chest...'
              }
              value={appearanceText}
              onChange={handleAppearanceChange}
              maxLength={400}
              helperText={minLengthHint}
              error={appearanceTouched && !appearanceValid ? minLengthHint : undefined}
            />
            {characterGenerationError ? (
              <p className="text-xs text-[#ffb9b9]">{characterGenerationError}</p>
            ) : null}
            <div className="flex gap-3">
              <Button type="button" onClick={handleCharacterApplyAdjust}>
                {isJa ? '反映する' : 'Apply'}
              </Button>
              <button
                type="button"
                className="rounded-lg border border-divider px-4 py-2 text-sm text-textSecondary transition hover:border-accent"
                onClick={() => setShowCharacterAdjust(false)}
              >
                {isJa ? '閉じる' : 'Close'}
              </button>
            </div>
          </div>
        ) : null}
      </section>
    );
  };

  const renderGenerationStep = () => {
    if (!allReady) {
      if (hasGenerationFailure) {
        const failureTitle = isJa ? '準備が完了しませんでした' : 'Something is still missing';
        const failureBody = generationError
          ? generationError
          : isJa
            ? '一部の素材が届いていません。もう一度試すか、あるいはこのまま進むこともできます。'
            : 'Some pieces did not finish. You can retry or move forward with what we have.';
        const failureList = [
          {
            id: 'model',
            label: isJa ? '3Dモデル' : '3D model',
            failed: modelFailed,
          },
          {
            id: 'composite',
            label: isJa ? '合成画像' : 'Composite image',
            failed: compositeFailed,
          },
          {
            id: 'story',
            label: isJa ? '物語' : 'Story',
            failed: storyFailed,
          },
        ];

        return (
          <section className="space-y-4">
            <h2 className="text-base font-semibold text-textPrimary">{failureTitle}</h2>
            <p className="text-sm text-textSecondary">{failureBody}</p>
            <ul className="space-y-2 text-xs text-textSecondary">
              {failureList.map(({ id, label, failed }) => (
                <li
                  key={id}
                  className="flex items-center justify-between rounded-2xl border border-divider px-3 py-2"
                >
                  <span>{label}</span>
                  <span className={failed ? 'text-[#ffb9b9]' : 'text-emerald-300'}>
                    {failed ? (isJa ? '失敗' : 'Failed') : isJa ? '完了' : 'Ready'}
                  </span>
                </li>
              ))}
            </ul>
            <div className="space-y-2">
              <Button type="button" onClick={handleGenerationRetry} disabled={generationRunning}>
                {generationRunning
                  ? isJa
                    ? 'もう一度ためしています…'
                    : 'Retrying...'
                  : isJa
                    ? 'もう一度ためす'
                    : 'Try again'}
              </Button>
              <button
                type="button"
                className="w-full rounded-lg border border-divider px-4 py-2 text-sm text-textSecondary transition hover:border-accent"
                onClick={handleGenerationSkip}
              >
                {isJa ? 'このまま進む' : 'Skip and continue'}
              </button>
            </div>
          </section>
        );
      }

      return (
        <LoadingScreen
          visible
          variant="creation"
          title={creationLoadingTitle}
          message={
            <div className="space-y-3">
              <p className="text-xs leading-5 text-textSecondary">
                {generationError ?? creationLoadingMessage}
              </p>
              <ProgressBar stages={progressStages} />
            </div>
          }
          mode="page"
        />
      );
    }

    return (
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-textPrimary">
          {isJa ? 'エモカイが準備できました' : 'Your Emokai is ready'}
        </h2>
        <p className="text-sm text-textSecondary">
          {isJa
            ? '景色とエモカイ、物語がそろいました。記録を確認しましょう。'
            : 'The scenery, companion, and story are here. Let’s review them.'}
        </p>
        <ProgressBar stages={progressStages} />
        <div className="pt-2">
          <button
            type="button"
            className={primaryButtonClass}
            onClick={() => router.push(`/${locale}/emokai/step/12`)}
          >
            {isJa ? '記録を確認する' : 'View record'}
          </button>
        </div>
      </section>
    );
  };

  const renderDiscoveryStep = () => (
    <section className="space-y-4">
      <h2 className="text-base font-semibold text-textPrimary">
        {isJa ? '新しいエモカイを検知しました！' : 'Found!'}
      </h2>
      <p className="text-sm text-textSecondary">
        {isJa
          ? 'あなたのエモカイが姿を見せました。'
          : 'Your Emokai has appeared. Getting the record ready.'}
      </p>
      <div className="aspect-square w-full overflow-hidden rounded-2xl border border-divider bg-[rgba(237,241,241,0.08)]">
        {(() => {
          const composite = generationResults?.results.composite;
          if (!composite) return null;
          const url =
            (composite.url &&
            (composite.url.startsWith('data:') ||
              composite.url.startsWith('blob:') ||
              /^https?:/i.test(composite.url))
              ? composite.url
              : null) ??
            (composite.imageBase64 && composite.mimeType
              ? `data:${composite.mimeType};base64,${composite.imageBase64}`
              : null);
          if (!url) return null;
          return (
            <img
              src={url}
              alt={isJa ? 'エモカイのすがた' : 'Emokai composite'}
              className="h-full w-full object-cover"
            />
          );
        })()}
      </div>
      <div className="pt-2">
        <button
          type="button"
          className={primaryButtonClass}
          onClick={() => router.push(`/${locale}/emokai/step/13`)}
        >
          {isJa ? 'つづける' : 'Continue'}
        </button>
      </div>
    </section>
  );

  const renderDetailStep = () => (
    <section className="space-y-4">
      <h2 className="text-base font-semibold text-textPrimary">
        {isJa ? 'エモカイの記録' : 'Emokai record'}
      </h2>
      <div className="space-y-3 rounded-2xl border border-divider p-4 text-sm text-textSecondary">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] opacity-70">
            {isJa ? '番号' : 'Number'}
          </p>
          <p>No. {creations.length + 1}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] opacity-70">{isJa ? '名前' : 'Name'}</p>
          <p>{isJa ? `エモカイ ${creations.length + 1}` : `Emokai ${creations.length + 1}`}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] opacity-70">{isJa ? '場所' : 'Place'}</p>
          <p>{placeText || '—'}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] opacity-70">
            {isJa ? '気持ち' : 'Emotions'}
          </p>
          <p>
            {selectedEmotions.length
              ? selectedEmotions.map((emotion) => getEmotionLabel(emotion)).join(isJa ? '、' : ', ')
              : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] opacity-70">
            {isJa ? 'ふるまい' : 'Action'}
          </p>
          <p>{actionText || '—'}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] opacity-70">
            {isJa ? 'すがた' : 'Appearance'}
          </p>
          <p>{appearanceText || '—'}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] opacity-70">{isJa ? '物語' : 'Story'}</p>
          <p className="whitespace-pre-wrap text-textPrimary">
            {generationResults?.results.story?.content || '—'}
          </p>
        </div>
      </div>
      <div className="pt-2">
        <button
          type="button"
          className={primaryButtonClass}
          onClick={() => router.push(`/${locale}/emokai/step/14`)}
        >
          {isJa ? 'つぎへ' : 'Next'}
        </button>
      </div>
    </section>
  );

  const renderSummonStep = () => {
    const description = hasSummoned
      ? isJa
        ? 'エモカイが現実の世界に姿を見せてくれました。旅立つ準備ができたら、次へ進みましょう。'
        : 'Your Emokai has just visited your space. When you are ready, continue to send them off.'
      : isJa
        ? 'カメラをひらいて、近くの平らな場所にあらわれてもらいましょう。明るいところだと見つけやすいです。'
        : 'Open the camera and place it on a flat surface. Bright places work best.';

    return (
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-textPrimary">
          {isJa ? 'この世界に呼び出す' : 'Bring into this world'}
        </h2>
        <p className="text-sm text-textSecondary">{description}</p>
        {hasSummoned ? (
          <>
            <div className="pt-2">
              <button type="button" className={primaryButtonClass} onClick={handleSummonContinue}>
                {isJa ? '次へ進む' : 'Continue'}
              </button>
            </div>
            <button
              type="button"
              className="text-sm text-accent underline transition hover:opacity-80"
              onClick={handleArSummon}
            >
              {isJa ? 'もう一度呼び出す' : 'Summon again'}
            </button>
          </>
        ) : (
          <div className="pt-2">
            <button type="button" className={primaryButtonClass} onClick={handleArSummon}>
              {summonLabel}
            </button>
          </div>
        )}
      </section>
    );
  };

  const renderGalleryStep = () => (
    <section className="space-y-4">
      <h2 className="text-base font-semibold text-textPrimary">
        {isJa ? 'エモカイを世界へ送り出す' : 'Send your Emokai off'}
      </h2>
      <p className="text-sm text-textSecondary">
        {isJa
          ? 'あなたのエモカイは旅に出る準備ができました。ギャラリーではいつでも再会できます。'
          : 'Your Emokai is ready to journey onward. You can revisit them anytime in the gallery.'}
      </p>
      <div className="aspect-square w-full overflow-hidden rounded-2xl border border-divider bg-[rgba(237,241,241,0.08)]">
        {(() => {
          const composite = generationResults?.results.composite;
          if (!composite) return null;
          const url =
            (composite.url &&
            (composite.url.startsWith('data:') ||
              composite.url.startsWith('blob:') ||
              /^https?:/i.test(composite.url))
              ? composite.url
              : null) ??
            (composite.imageBase64 && composite.mimeType
              ? `data:${composite.mimeType};base64,${composite.imageBase64}`
              : null);
          if (!url) return null;
          return (
            <img
              src={url}
              alt={isJa ? 'エモカイのすがた' : 'Emokai composite'}
              className="h-full w-full object-cover"
            />
          );
        })()}
      </div>
      <div className="pt-2">
        <button type="button" className={primaryButtonClass} onClick={handleSendOff}>
          {isJa ? '送り出す' : 'Send off'}
        </button>
      </div>
    </section>
  );

  // ====== 画面本体 ======

  const content = (() => {
    switch (step) {
      case 1:
        return (
          <section className="space-y-3">
            <InstructionBanner tone="default">
              {isJa ? '感情の妖怪をさがしに行こう。' : 'Set out to find the yokai of feelings.'}
            </InstructionBanner>
            <h2 className="text-base font-semibold text-textPrimary">EMOKAI</h2>
            <p className="text-sm text-textSecondary">
              {isJa ? '感情の妖怪をさがしに行こう。' : 'Find the yokai of feelings.'}
            </p>
            <div className="pt-4">
              <button
                type="button"
                className={primaryButtonClass}
                onClick={() => router.push(`/${locale}/emokai/step/2`)}
              >
                {isJa ? 'はじめる' : 'Begin'}
              </button>
            </div>
          </section>
        );
      case 2:
        return (
          <section className="space-y-3">
            <StepLabel text={stepLabelText} />
            <h2 className="text-base font-semibold text-textPrimary">
              {isJa ? 'エモカイとは' : 'What is Emokai'}
            </h2>
            <p className="text-sm text-textSecondary">
              {isJa
                ? 'エモカイは、あなたの感情や記憶から生まれる“感情の妖怪”。まだ誰も見たことのない、あなただけの存在です。言葉にならない気持ちと、大切な場所を思い浮かべると、少しずつ姿を見せはじめます。まずは、心に浮かぶ場所をひとつ思い出してみてください。'
                : 'Emokai is a yokai born from your feelings and memories. Think of a place that matters, and its shape will begin to appear.'}
            </p>
            <div className="pt-4">
              <button
                type="button"
                className={primaryButtonClass}
                onClick={() => router.push(`/${locale}/emokai/step/3`)}
              >
                {isJa ? 'つづける' : 'Continue'}
              </button>
            </div>
          </section>
        );
      case 3: {
        const locationLabel = geoCoords
          ? formatCoordinates(geoCoords.lat, geoCoords.lng, isJa)
          : placeText.trim().length
            ? placeText.trim()
            : geoStatus === 'loading'
              ? isJa
                ? '位置情報を取得しています…'
                : 'Fetching your location…'
              : isJa
                ? '位置情報がまだ取得できていません'
                : 'Location not available yet';

        return (
          <section className="flex h-full flex-col space-y-4">
            <div className="space-y-3">
              <StepLabel text={stepLabelText} />
              <h2 className="text-base font-semibold text-textPrimary">
                {isJa ? 'あなたの場所' : 'Your place'}
              </h2>
              <p className="text-sm text-textSecondary">
                {isJa
                  ? '地図を見ながら、エモカイと結びついた場所を思い浮かべてください。'
                  : 'Look at the map and recall the place tied to your Emokai.'}
              </p>
              <div className="relative">
                <RichInput
                  rows={1}
                  label=""
                  placeholder={
                    isJa
                      ? '場所や住所を入力すると地図が移動します。'
                      : 'Type a place or address to move the map.'
                  }
                  value={placeText}
                  onChange={handlePlaceChange}
                  maxLength={300}
                  showCounter={false}
                  error={placeTouched && !placeValid ? minLengthHint : undefined}
                />
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-textSecondary">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    fill="currentColor"
                    viewBox="0 0 16 16"
                  >
                    <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85Zm-5.242.656a5 5 0 1 1 0-10 5 5 0 0 1 0 10Z" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="flex h-[320px] flex-col">
              <div className="relative flex-1 overflow-hidden rounded-3xl border border-divider bg-[rgba(237,241,241,0.08)]">
                {mapEmbedUrl ? (
                  <iframe
                    src={mapEmbedUrl}
                    title={isJa ? '選択した場所の地図' : 'Selected place map'}
                    loading="lazy"
                    className="h-full w-full"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-textSecondary">
                    {geoStatus === 'loading'
                      ? isJa
                        ? '地図を準備しています…'
                        : 'Preparing the map…'
                      : isJa
                        ? '地図を表示できません。下の「調整する」から場所を入力できます。'
                        : 'Map is unavailable. You can input the place below.'}
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-textSecondary">
                <span>{locationLabel}</span>
                <button
                  type="button"
                  className="rounded-lg border border-divider px-3 py-1 text-xs text-textSecondary transition hover:border-accent"
                  onClick={requestGeolocation}
                  disabled={geoStatus === 'loading'}
                >
                  {isJa ? '再取得' : 'Retry'}
                </button>
              </div>
            </div>
            <div className="pt-2">
              <Button
                type="button"
                onClick={() => router.push(`/${locale}/emokai/step/4`)}
                disabled={!placeValid}
              >
                {isJa ? 'つづける' : 'Continue'}
              </Button>
            </div>
          </section>
        );
      }
      case 4:
        return (
          <section className="space-y-4">
            <StepLabel text={stepLabelText} />
            <h2 className="text-base font-semibold text-textPrimary">
              {isJa ? '場所を思い出す' : 'Recall the place'}
            </h2>
            <p className="text-sm text-textSecondary">
              {isJa
                ? '目を閉じて、その場所を歩いてみましょう。空気の温度や足元の感触をたしかめてください。'
                : 'Close your eyes and walk there in your mind. Notice the temperature of the air and how the ground feels underfoot.'}
            </p>
            <p className="text-sm text-textSecondary">
              {isJa
                ? '風や光、音、匂い…さっき思い浮かべた場所の気配を感じてみてください。'
                : 'Listen for wind, light, sounds, and scents—let the mood of that place surround you.'}
            </p>
            <div className="pt-4">
              <Button type="button" onClick={() => router.push(`/${locale}/emokai/step/5`)}>
                {nextLabel}
              </Button>
            </div>
          </section>
        );
      case 5:
        return (
          <section className="space-y-4">
            <StepLabel text={stepLabelText} />
            <h2 className="text-base font-semibold text-textPrimary">
              {isJa ? 'この場所で感じる気持ち' : 'Feelings in this place'}
            </h2>
            <p className="text-sm text-textSecondary">
              {isJa
                ? '当てはまるものをえらんでください。（いくつでも）'
                : 'Choose what fits (any number).'}
            </p>
            <div className="space-y-3">
              {EMOTION_GROUPS.map((group) => (
                <div key={group.id} className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {group.emotions.map((emotion) => {
                      const selected = selectedEmotions.includes(emotion);
                      const palette = EMOTION_COLORS[emotion] ?? DEFAULT_EMOTION_COLORS;
                      const style: CSSProperties = selected
                        ? {
                            backgroundColor: palette.solid,
                            color: palette.onSolid,
                            borderColor: palette.solid,
                          }
                        : {
                            borderColor: palette.light,
                            color: palette.light,
                          };
                      const buttonClass = `${emotionButtonClass} ${selected ? 'shadow-sm' : ''}`;
                      return (
                        <button
                          key={emotion}
                          type="button"
                          className={buttonClass}
                          style={style}
                          onClick={() => toggleEmotion(emotion)}
                        >
                          {getEmotionLabel(emotion)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-textSecondary opacity-70">
              {isJa
                ? '左から強い感情で、右にいくほど穏やかなニュアンスになります。'
                : 'Left is the strongest tone and it softens toward the right.'}
            </p>
            {!emotionValid && emotionTouched ? (
              <p className="text-xs text-[#ffb9b9]">
                {isJa ? 'まだ気持ちが映っていません。ひとつ選んでみましょう。' : selectOneHint}
              </p>
            ) : null}
            <div className="pt-2">
              <button
                type="button"
                className={primaryButtonClass}
                onClick={() => {
                  if (!emotionValid) {
                    setEmotionTouched(true);
                    return;
                  }
                  router.push(`/${locale}/emokai/step/6`);
                }}
              >
                {isJa ? 'つぎへ' : 'Next'}
              </button>
            </div>
          </section>
        );
      case 6:
        if (stageStatus === 'generating') {
          return (
            <LoadingScreen
              visible
              variant="stage"
              title={stageLoadingTitle}
              message={stageLoadingMessage}
              mode="page"
            />
          );
        }
        return (
          <section className="space-y-3">
            <StepLabel text={stepLabelText} />
            <h2 className="text-base font-semibold text-textPrimary">
              {isJa ? 'その場所が特別なわけ' : 'Why this place matters'}
            </h2>
            <p className="text-sm text-textSecondary">
              {isJa
                ? '目を閉じて、その場所を歩くところを想像してみましょう。風、光、音…その先でエモカイが待っています。'
                : 'Close your eyes and picture yourself walking there—the wind, the light, the sounds, and the Emokai waiting ahead.'}
            </p>
            <p className="text-sm text-textSecondary">
              {isJa
                ? 'なぜ、その場所があなたにとって大事なのか教えてください。思い出でも、気持ちでも、願いでも。その想いが、エモカイの“こころ”になります。'
                : 'Share why this place matters—memories, feelings, wishes. They become the Emokai’s heart.'}
            </p>
            <RichInput
              label=""
              placeholder={
                isJa
                  ? '迷ったとき、ここで深呼吸すると落ち着くから…'
                  : "When I'm lost, a deep breath here calms me..."
              }
              value={reasonText}
              onChange={handleReasonChange}
              maxLength={300}
              helperText={minLengthHint}
              error={reasonTouched && !reasonValid ? minLengthHint : undefined}
            />
            <div className="pt-2">
              <button
                type="button"
                className={primaryButtonClass}
                onClick={handleProceedToStageStep}
              >
                {isJa ? '場所を映し出す' : 'Reveal the place'}
              </button>
            </div>
          </section>
        );
      case 7:
        return renderStageStep();
      case 8:
        return (
          <section className="space-y-3">
            <StepLabel text={stepLabelText} />
            <h2 className="text-base font-semibold text-textPrimary">
              {isJa ? 'エモカイは何をする？' : 'What does the Emokai do?'}
            </h2>
            <p className="text-sm text-textSecondary">
              {isJa
                ? 'あなたがそこへ行くと、エモカイはどう動きますか。そっと寄りそう？ いたずらする？ 見守ってくれる？'
                : 'When you arrive, how does your Emokai behave? Approaches? Teases? Watches over you?'}
            </p>
            <RichInput
              label=""
              placeholder={
                isJa
                  ? '肩にとまって小さく歌う／落ち葉で道しるべを作る…'
                  : 'Perches on your shoulder and hums / Gathers leaves into a path...'
              }
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
                {isJa ? 'つぎへ' : 'Next'}
              </button>
            </div>
          </section>
        );
      case 9:
        if (characterStatus === 'generating') {
          return (
            <LoadingScreen
              visible
              variant="character"
              title={characterLoadingTitle}
              message={characterLoadingMessage}
              mode="page"
            />
          );
        }
        return (
          <section className="space-y-3">
            <StepLabel text={stepLabelText} />
            <h2 className="text-base font-semibold text-textPrimary">
              {isJa ? 'エモカイのすがた' : "The Emokai's form"}
            </h2>
            <p className="text-sm text-textSecondary">
              {isJa
                ? '色、質感、大きさ、音、匂い…思いつくことを自由に。'
                : 'Color, texture, size, sounds, scents—anything you imagine.'}
            </p>
            <RichInput
              label=""
              placeholder={
                isJa
                  ? '薄い水色で半透明。胸に小さな灯。歩くと鈴の音…'
                  : 'Pale blue and translucent; a small light in its chest; a soft chime when it walks...'
              }
              value={appearanceText}
              onChange={handleAppearanceChange}
              maxLength={400}
              helperText={minLengthHint}
              error={appearanceTouched && !appearanceValid ? minLengthHint : undefined}
            />
            {characterGenerationError ? (
              <p className="text-xs text-[#ffb9b9]">{characterGenerationError}</p>
            ) : null}
            <div className="pt-2">
              <button
                type="button"
                className={primaryButtonClass}
                onClick={handleProceedToCharacterStep}
              >
                {isJa ? 'エモカイの姿を映し出す' : 'Reveal the Emokai'}
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
    <main className="mx-auto flex h-screen w-full max-w-md flex-col bg-canvas">
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
      <div className="flex-1 space-y-6 overflow-y-auto px-4 py-6 sm:px-6">{content}</div>
    </main>
  );
}
