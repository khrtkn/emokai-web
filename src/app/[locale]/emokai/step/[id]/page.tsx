'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
} from 'react';
import { useRouter } from 'next/navigation';

import { Button, ImageOption, LoadingScreen, RichInput, ScreenBackground } from '@/components/ui';
import { moderateText } from '@/lib/moderation';
import type { StageOption } from '@/lib/stage-generation';
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
  CHARACTER_OPTIONS_KEY,
  GENERATION_RESULTS_KEY,
  STAGE_SELECTION_KEY,
  CHARACTER_NAME_KEY,
  AR_SUMMON_KEY,
  PLACE_STORAGE_KEY,
  REASON_STORAGE_KEY,
  ACTION_STORAGE_KEY,
  APPEARANCE_STORAGE_KEY,
  EMOTIONS_STORAGE_KEY,
  GEO_COORDS_STORAGE_KEY,
} from '@/lib/storage-keys';
import {
  acquireGenerationLock,
  isGenerationLocked,
  releaseGenerationLock,
} from '@/lib/session-lock';
import type { Locale } from '@/lib/i18n/messages';
import { saveCreation } from '@/lib/persistence';
import { cacheImage, getCachedImage } from '@/lib/image-cache';
import { isLiveApisEnabled } from '@/lib/env/client';
import { detectDeviceType, getModelTargetFormats } from '@/lib/device';
import { logDebug, logError, logWarn } from '@/lib/logger';

const MIN_TEXT_LENGTH = 1;
const TOTAL_STEPS = 15;
const SIMPLIFIED_FLOW_STEPS = [1, 2, 3, 5, 9, 10, 14, 15] as const;
const DEFAULT_COORD_QUERY = '35.681236,139.767125';
const MODEL_URL_STORAGE_KEY = 'emokai_last_model_url';
const GENERATION_UPDATE_EVENT = 'emokai:generation-update';
const MODEL_URL_UPDATE_EVENT = 'emokai:model-url-update';
const PROGRESS_STORAGE_KEY = 'emokai-progress';
const PROGRESS_RESUME_FLAG = 'emokai-progress-resume-state';
const PROGRESS_VERSION = 1;
const PROGRESS_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24h

function broadcastClientEvent(name: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(name));
}

function formatTwoDigits(value: number) {
  return value.toString().padStart(2, '0');
}

function buildDefaultName() {
  const now = new Date();
  const year = now.getFullYear();
  const month = formatTwoDigits(now.getMonth() + 1);
  const day = formatTwoDigits(now.getDate());
  const hours = formatTwoDigits(now.getHours());
  const minutes = formatTwoDigits(now.getMinutes());

  return `Emokai-${year}${month}${day}${hours}${minutes}`;
}

type EmotionDefinition = {
  id: string;
  ja: string;
  en: string;
};

type EmotionGroup = {
  id: string;
  plutchikKey: keyof EmotionLevelMap;
  label: { en: string; ja: string };
  description: { en: string; ja: string };
  color: { solid: string; light: string; onSolid: string };
  emotions: EmotionDefinition[];
};


const EMOTION_GROUPS: EmotionGroup[] = [
  {
    id: 'joy',
    plutchikKey: 'joy',
    label: { en: 'Joy', ja: '喜び' },
    description: {
      en: 'Soothing, plentiful warmth—quiet happiness and relief.',
      ja: '静かに満ちる喜びや安堵。',
    },
    color: { solid: '#F59E0B', light: '#FCD34D', onSolid: '#1F2937' },
    emotions: [
      { id: 'joy-ecstasy', ja: '有頂天', en: 'Ecstatic' },
      { id: 'joy-joyful', ja: '喜び', en: 'Joyful' },
      { id: 'joy-serenity', ja: '穏やかさ', en: 'Serene' },
      { id: 'joy-relief', ja: '安心', en: 'Relieved' },
      { id: 'joy-release', ja: '安堵', en: 'Released' },
      { id: 'joy-ease', ja: 'ほっとする', en: 'At ease' },
      { id: 'joy-calm', ja: '落ち着く', en: 'Calm' },
      { id: 'joy-soothe', ja: '和む', en: 'Soothing' },
      { id: 'joy-healed', ja: '癒される', en: 'Healed' },
      { id: 'joy-fulfilled', ja: '満ち足りる', en: 'Fulfilled' },
      { id: 'joy-quietly-moved', ja: 'しみじみ', en: 'Quietly moved' },
    ],
  },
  {
    id: 'trust',
    plutchikKey: 'trust',
    label: { en: 'Trust & Social', ja: '信頼・関係' },
    description: {
      en: 'Feelings that surface when navigating people, duty, and care.',
      ja: '人との距離感や義理・思いやりに揺れる感情。',
    },
    color: { solid: '#7C3AED', light: '#C4B5FD', onSolid: '#F9FAFB' },
    emotions: [
      { id: 'trust-embarrassed', ja: '恥ずかしい', en: 'Embarrassed' },
      { id: 'trust-bashful', ja: '照れくさい', en: 'Bashful' },
      { id: 'trust-awkward', ja: '気まずい', en: 'Awkward' },
      { id: 'trust-out-of-place', ja: 'いたたまれない', en: 'Out of place' },
      { id: 'trust-apologetic', ja: '申し訳ない', en: 'Apologetic' },
      { id: 'trust-guilty', ja: '後ろめたい', en: 'Guilty' },
      { id: 'trust-disgraced', ja: '面目ない', en: 'Loss of face' },
      { id: 'trust-ashamed', ja: '情けない', en: 'Ashamed' },
      { id: 'trust-indebted', ja: '負い目がある', en: 'Indebted' },
      { id: 'trust-grateful', ja: 'ありがたい', en: 'Grateful' },
      { id: 'trust-troublesome-blessing', ja: 'ありがた迷惑', en: 'Grateful yet troubled' },
      { id: 'trust-restraint', ja: '遠慮', en: 'Holding back' },
      { id: 'trust-considerate', ja: '気遣い', en: 'Considerate' },
      { id: 'trust-self-conscious', ja: '気にする', en: 'Self-conscious' },
      { id: 'trust-amae', ja: '甘え', en: 'Seeking indulgence' },
      { id: 'trust-duty', ja: '義理', en: 'Sense of duty' },
      { id: 'trust-favor-debt', ja: '恩', en: 'Owing a favor' },
    ],
  },
  {
    id: 'fear',
    plutchikKey: 'fear',
    label: { en: 'Fear & Anxiety', ja: '恐れ・不安' },
    description: {
      en: 'Unease, dread, and the urge to protect yourself.',
      ja: '身を縮めるような恐れやざわめき。',
    },
    color: { solid: '#4338CA', light: '#A5B4FC', onSolid: '#EEF2FF' },
    emotions: [
      { id: 'fear-terror', ja: '恐怖', en: 'Terror' },
      { id: 'fear-fear', ja: '恐れ', en: 'Fearful' },
      { id: 'fear-apprehension', ja: '不安', en: 'Apprehensive' },
      { id: 'fear-nervous', ja: '緊張', en: 'Tense' },
      { id: 'fear-shiver', ja: 'ぞくっとする', en: 'Shiver' },
      { id: 'fear-wary', ja: '警戒', en: 'Wary' },
      { id: 'fear-startled', ja: 'ハッとする', en: 'Startled' },
      { id: 'fear-shrinking', ja: '身がすくむ', en: 'Shrinking' },
    ],
  },
  {
    id: 'surprise',
    plutchikKey: 'surprise',
    label: { en: 'Surprise & Wonder', ja: '驚き・まばゆさ' },
    description: {
      en: 'Moments that jolt or dazzle before you find words.',
      ja: 'ハッとする驚きや、圧倒される瞬間。',
    },
    color: { solid: '#0EA5E9', light: '#7DD3FC', onSolid: '#082F49' },
    emotions: [
      { id: 'surprise-amazement', ja: '驚嘆', en: 'Amazed' },
      { id: 'surprise-surprise', ja: '驚き', en: 'Surprised' },
      { id: 'surprise-confused', ja: '戸惑い', en: 'Confused' },
      { id: 'surprise-dazzled', ja: '目を奪われる', en: 'Dazzled' },
      { id: 'surprise-overwhelmed', ja: '圧倒される', en: 'Overwhelmed' },
      { id: 'surprise-spark', ja: 'ひらめき', en: 'Spark' },
    ],
  },
  {
    id: 'sadness',
    plutchikKey: 'sadness',
    label: { en: 'Bittersweet & Hollow', ja: '切なさ・空虚' },
    description: {
      en: 'Lingering sorrow, longing, and tender emptiness.',
      ja: '胸の奥で静かに響く悲しさや恋しさ。',
    },
    color: { solid: '#2563EB', light: '#93C5FD', onSolid: '#EFF6FF' },
    emotions: [
      { id: 'sadness-grief', ja: '深い悲しみ', en: 'Grief' },
      { id: 'sadness-sadness', ja: '悲しみ', en: 'Sad' },
      { id: 'sadness-pensive', ja: '物思い', en: 'Pensive' },
      { id: 'sadness-bittersweet', ja: '切ない', en: 'Bittersweet' },
      { id: 'sadness-helpless', ja: 'やるせない', en: 'Helpless' },
      { id: 'sadness-hollow', ja: '虚しい', en: 'Hollow' },
      { id: 'sadness-melancholy', ja: '憂鬱', en: 'Melancholic' },
      { id: 'sadness-insecure', ja: '心細い', en: 'Insecure' },
      { id: 'sadness-lonely', ja: '寂しい', en: 'Lonely' },
      { id: 'sadness-longing', ja: '恋しい', en: 'Longing' },
      { id: 'sadness-attachment', ja: '未練', en: 'Lingering attachment' },
    ],
  },
  {
    id: 'disgust',
    plutchikKey: 'disgust',
    label: { en: 'Muddle & Weariness', ja: 'もやもや・疲れ' },
    description: {
      en: 'Diffuse discomfort, burnout, and subtle repulsion.',
      ja: 'もやもやと積もる不快感や消耗。',
    },
    color: { solid: '#0F766E', light: '#34D399', onSolid: '#ECFDF5' },
    emotions: [
      { id: 'disgust-haze', ja: 'もやもや', en: 'Hazy unease' },
      { id: 'disgust-irritated', ja: 'イライラ', en: 'Irritated' },
      { id: 'disgust-pissed', ja: 'むかつく', en: 'Pissed off' },
      { id: 'disgust-fed-up', ja: 'うんざり', en: 'Fed up' },
      { id: 'disgust-drained', ja: 'げんなり', en: 'Drained' },
      { id: 'disgust-sluggish', ja: 'だるい', en: 'Sluggish' },
      { id: 'disgust-bothersome', ja: 'めんどくさい', en: 'Bothered' },
      { id: 'disgust-overloaded', ja: 'しんどい', en: 'Overloaded' },
      { id: 'disgust-depleted', ja: '消耗している', en: 'Depleted' },
    ],
  },
  {
    id: 'anger',
    plutchikKey: 'anger',
    label: { en: 'Heat & Frustration', ja: '怒り・苛立ち' },
    description: {
      en: 'Sharp sparks of protest and irritation.',
      ja: '噴き出す怒りや苛立ちの熱。',
    },
    color: { solid: '#DC2626', light: '#FCA5A5', onSolid: '#FEF2F2' },
    emotions: [
      { id: 'anger-rage', ja: '激怒', en: 'Rage' },
      { id: 'anger-anger', ja: '怒り', en: 'Anger' },
      { id: 'anger-annoyance', ja: '苛立ち', en: 'Annoyed' },
      { id: 'anger-frustrated', ja: 'フラストレーション', en: 'Frustrated' },
      { id: 'anger-grit', ja: '噛みしめる', en: 'Grinding teeth' },
      { id: 'anger-impatient', ja: '焦れったい', en: 'Impatient' },
    ],
  },
  {
    id: 'anticipation',
    plutchikKey: 'anticipation',
    label: { en: 'Thrill & Foresight', ja: 'ときめき・期待' },
    description: {
      en: 'Fluttering excitement, awe, and forward pull.',
      ja: '胸が高鳴る期待や畏敬。',
    },
    color: { solid: '#DB2777', light: '#F9A8D4', onSolid: '#FFF5F7' },
    emotions: [
      { id: 'anticipation-vigilance', ja: '警戒', en: 'Vigilant' },
      { id: 'anticipation-anticipation', ja: '期待', en: 'Anticipating' },
      { id: 'anticipation-interest', ja: '興味', en: 'Curious' },
      { id: 'anticipation-flutter', ja: 'ときめき', en: 'Fluttering' },
      { id: 'anticipation-excited', ja: 'ワクワク', en: 'Excited' },
      { id: 'anticipation-thrill', ja: 'ドキドキ', en: 'Thrilled' },
      { id: 'anticipation-uplift', ja: '高揚', en: 'Uplifted' },
      { id: 'anticipation-moved', ja: '感動', en: 'Moved' },
      { id: 'anticipation-awe', ja: '畏敬', en: 'Awestruck' },
      { id: 'anticipation-full-heart', ja: '胸がいっぱい', en: 'Heart full' },
    ],
  },
];
const EMOTION_LANE_COUNT = EMOTION_GROUPS.length;

const EMOTION_DEFINITION_MAP: Record<string, EmotionDefinition & { groupId: string }> = {};
const EMOTION_COLOR_MAP: Record<string, { solid: string; light: string; onSolid: string }> = {};
EMOTION_GROUPS.forEach((group) => {
  group.emotions.forEach((emotion) => {
    EMOTION_DEFINITION_MAP[emotion.id] = { ...emotion, groupId: group.id };
    EMOTION_COLOR_MAP[emotion.id] = group.color;
  });
});

const DEFAULT_EMOTION_COLORS = {
  solid: '#2563EB',
  light: '#60A5FA',
  onSolid: '#EFF6FF',
};

const EMOTION_FLOW_REPEAT = 3;
const EMOTION_ROW_REPEAT = 3;

const emotionButtonClass =
  'inline-flex min-h-[40px] items-center whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium tracking-wide transition-shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

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

const COORDINATE_EPSILON = 1e-6;

function parseCoordinateLabel(value: string): { lat: number; lng: number } | null {
  const text = value.trim();
  if (!text) return null;
  const numbers = text.match(/[-+]?\d+(?:\.\d+)?/g);
  if (!numbers || numbers.length < 2) {
    return null;
  }

  let lat = Number(numbers[0]);
  let lng = Number(numbers[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  const lower = text.toLowerCase();
  const hasNorth = lower.includes('北緯') || lower.includes('north');
  const hasSouth = lower.includes('南緯') || lower.includes('south');
  const hasEast = lower.includes('東経') || lower.includes('east');
  const hasWest = lower.includes('西経') || lower.includes('west');

  if (hasSouth && !hasNorth) {
    lat = -Math.abs(lat);
  } else if (hasNorth && !hasSouth) {
    lat = Math.abs(lat);
  }

  if (hasWest && !hasEast) {
    lng = -Math.abs(lng);
  } else if (hasEast && !hasWest) {
    lng = Math.abs(lng);
  }

  return { lat, lng };
}

function mergeCoordinates(
  previous: { lat: number; lng: number } | null,
  next: { lat: number; lng: number },
) {
  if (!previous) return next;
  const latDiff = Math.abs(previous.lat - next.lat);
  const lngDiff = Math.abs(previous.lng - next.lng);
  if (latDiff > COORDINATE_EPSILON || lngDiff > COORDINATE_EPSILON) {
    return next;
  }
  return previous;
}

type CharacterFlowStatus = 'idle' | 'generating' | 'ready' | 'error';
type SubmissionState = 'idle' | 'saving' | 'success' | 'error';
type GeoStatus = 'idle' | 'loading' | 'success' | 'error';
type JobStatus = 'pending' | 'active' | 'complete' | 'error';

type GenerationResults = {
  model?: ModelResult;
  composite?: CompositeResult;
  story?: StoryResult;
};

type StoredGenerationPayload = {
  characterId: string;
  description: string;
  name: string;
  results: GenerationResults;
  completedAt: number | null;
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

type ProgressSerializable = {
  locale: Locale;
  step: number;
  placeText: string;
  placeTouched: boolean;
  reasonText: string;
  reasonTouched: boolean;
  actionText: string;
  actionTouched: boolean;
  appearanceText: string;
  appearanceTouched: boolean;
  characterName: string;
  selectedEmotions: string[];
  emotionTouched: boolean;
  geoCoords: { lat: number; lng: number } | null;
  geoStatus: GeoStatus;
  geoError: string | null;
  showCharacterAdjust: boolean;
  submissionState: SubmissionState;
  submissionError: string | null;
};

type ProgressSnapshot = ProgressSerializable & {
  version: number;
  savedAt: number;
};

type EmotionLevelMap = {
  joy: number;
  trust: number;
  fear: number;
  surprise: number;
  sadness: number;
  disgust: number;
  anger: number;
  anticipation: number;
};

function createCompositeInstructionText(actionText: string, isJa: boolean): string {
  const trimmed = actionText.trim();
  const lines: (string | undefined)[] = isJa
    ? [
        '背景画像の中央から少し手前にキャラクターを配置してください。',
        '背景の光源方向と強さに合わせて、キャラクターの明るさやカラーを馴染ませます。',
        '足元に柔らかい影を落とし、地面と自然につながるようにしてください。',
        trimmed ? `キャラクターのふるまい: ${trimmed} を反映させたポーズや雰囲気にしてください。` : undefined,
      ]
    : [
        'Place the character slightly in front of the center of the background.',
        'Match lighting direction and intensity so the character blends naturally with the scene.',
        'Add a soft contact shadow at the character’s feet to anchor them to the ground.',
        trimmed ? `Incorporate this behavior into the pose or mood: ${trimmed}` : undefined,
      ];

  return lines.filter(Boolean).join('\n');
}

function extractCompositeUrl(composite?: CompositeResult | null): string | null {
  if (!composite) return null;
  const { url, imageBase64, mimeType } = composite;

  if (typeof url === 'string' && url.length > 0) {
    if (url.startsWith('data:') || url.startsWith('blob:') || /^https?:/i.test(url)) {
      return url;
    }
  }

  if (imageBase64 && mimeType) {
    return `data:${mimeType};base64,${imageBase64}`;
  }

  return null;
}

async function convertUrlToBase64(url: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    const base64 = btoa(binary);
    return { base64, mimeType: blob.type || 'application/octet-stream' };
  } catch (error) {
    logWarn('Failed to convert URL to base64', error);
    return null;
  }
}

async function readFileAsBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Unable to read file as data URL'));
        return;
      }
      const [, payload] = result.split(',');
      if (!payload) {
        reject(new Error('Invalid data URL result'));
        return;
      }
      resolve({ base64: payload, mimeType: file.type || 'image/jpeg' });
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('Failed to read file'));
    };
    reader.readAsDataURL(file);
  });
}

type StoredModel = {
  url?: string | null;
  alternates?: {
    usdz?: string | null;
    glb?: string | null;
  } | null;
};

function extractModelUrls(model: StoredModel | null | undefined) {
  const primary = typeof model?.url === 'string' ? model.url : null;
  const alternates = model?.alternates ?? {};
  const alternateUsdz = typeof alternates?.usdz === 'string' ? alternates.usdz : null;
  const alternateGlb = typeof alternates?.glb === 'string' ? alternates.glb : null;

  const hasExtension = (url: string | null, ext: string) =>
    typeof url === 'string' ? url.toLowerCase().includes(`.${ext.toLowerCase()}`) : false;

  const primaryIsUsdz = hasExtension(primary, 'usdz');
  const primaryIsGlb = hasExtension(primary, 'glb');

  const usdz = primaryIsUsdz ? primary : alternateUsdz;
  const glb = primaryIsGlb ? primary : alternateGlb;

  return {
    primary,
    usdz: usdz ?? null,
    glb: glb ?? null,
  };
}

function extractBase64FromDataUri(uri: string): { base64: string; mimeType: string } | null {
  const match = /^data:(?<type>[^;]+);base64,(?<data>.+)$/i.exec(uri);
  if (!match?.groups?.data) return null;
  return {
    base64: match.groups.data,
    mimeType: match.groups.type ?? 'application/octet-stream',
  };
}

async function readOptionImagePayload(
  option: { cacheKey?: string; previewUrl?: string; mimeType: string },
): Promise<{ base64: string; mimeType: string } | null> {
  const cached = option.cacheKey ? getCachedImage(option.cacheKey) : null;
  if (cached?.base64) {
    return { base64: cached.base64, mimeType: cached.mimeType };
  }

  if (option.previewUrl) {
    const dataUri = extractBase64FromDataUri(option.previewUrl);
    if (dataUri) {
      return dataUri;
    }

    const fetched = await convertUrlToBase64(option.previewUrl);
    if (fetched) {
      return { base64: fetched.base64, mimeType: fetched.mimeType || option.mimeType };
    }
  }

  return null;
}

async function readCompositeImagePayload(
  composite: CompositeResult,
): Promise<{ base64: string; mimeType: string } | { url: string; mimeType: string } | null> {
  if (composite.imageBase64) {
    return { base64: composite.imageBase64, mimeType: composite.mimeType };
  }

  if (composite.url) {
    const dataUri = extractBase64FromDataUri(composite.url);
    if (dataUri) {
      return dataUri;
    }

    const fetched = await convertUrlToBase64(composite.url);
    if (fetched) {
      return { base64: fetched.base64, mimeType: fetched.mimeType || composite.mimeType };
    }

    return { url: composite.url, mimeType: composite.mimeType };
  }

  return null;
}

async function compressBase64Image(
  image: { base64: string; mimeType: string },
  options: { maxDimension?: number; quality?: number } = {},
): Promise<{ base64: string; mimeType: string }> {
  const approxBytes = Math.ceil((image.base64.length * 3) / 4);
  const maxAllowed = 800 * 1024;
  if (approxBytes <= maxAllowed) {
    return image;
  }

  const maxDimension = options.maxDimension ?? 896;
  const quality = options.quality ?? 0.82;

  try {
    const dataUrl = `data:${image.mimeType};base64,${image.base64}`;
    const htmlImage = await loadImage(dataUrl);

    const largestSide = Math.max(htmlImage.width, htmlImage.height);
    const scale = largestSide > maxDimension ? maxDimension / largestSide : 1;
    const width = Math.max(1, Math.round(htmlImage.width * scale));
    const height = Math.max(1, Math.round(htmlImage.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return image;
    }

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(htmlImage, 0, 0, width, height);

    const targetMime = 'image/webp';
    const nextDataUrl = canvas.toDataURL(targetMime, quality);
    const nextBase64 = nextDataUrl.includes(',') ? nextDataUrl.split(',')[1] ?? image.base64 : image.base64;

    return { base64: nextBase64, mimeType: targetMime };
  } catch (error) {
    logWarn('Image compression failed', error);
    return image;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof window.Image === 'undefined') {
      reject(new Error('Image constructor unavailable'));
      return;
    }
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = (event) => {
      reject(event instanceof ErrorEvent ? event.error : new Error('Failed to load image'));
    };
    img.crossOrigin = 'anonymous';
    img.src = src;
  });
}

const primaryButtonClass =
  'inline-flex min-h-[56px] w-full items-center justify-center rounded-full bg-[#77FF9B] px-6 py-3 text-base font-semibold text-black shadow-[0_18px_45px_rgba(0,0,0,0.35)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60';
const secondaryButtonClass =
  'inline-flex min-h-[56px] w-full items-center justify-center rounded-full border border-white/30 bg-white/10 px-6 py-3 text-base font-semibold text-white/90 shadow-[0_20px_40px_rgba(0,0,0,0.35)] transition hover:border-white/60 hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#77FF9B]/60';

const ctaWrapperClass = 'sticky bottom-14 z-30 pt-10';

const panelClass = 'rounded-3xl';

const urlHasExtension = (value: string | null | undefined, extension: string) => {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.pathname.toLowerCase().endsWith(`.${extension.toLowerCase()}`);
  } catch {
    return value.toLowerCase().includes(`.${extension.toLowerCase()}`);
  }
};

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
        logWarn('Failed to parse stage selection', error);
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
        logWarn('Failed to parse character selection', error);
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
        logWarn('Failed to parse character options', error);
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
      name: typeof parsed.name === 'string' ? parsed.name : loadSessionString(NAME_STORAGE_KEY),
      results: {
        ...results,
        ...(composite ? { composite } : {}),
      },
      completedAt: parsed.completedAt ?? null,
    };

    return normalized;
  } catch (error) {
    logWarn('Failed to parse generation payload', error);
  }
  return null;
}

function persistGenerationPayload(payload: StoredGenerationPayload) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(GENERATION_RESULTS_KEY, JSON.stringify(payload));
  broadcastClientEvent(GENERATION_UPDATE_EVENT);
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

const markProgressResumed = () => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(PROGRESS_RESUME_FLAG, 'resumed');
};

const blockProgressResume = () => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(PROGRESS_RESUME_FLAG, 'blocked');
};

const wasProgressResumed = () => {
  if (typeof window === 'undefined') return false;
  return window.sessionStorage.getItem(PROGRESS_RESUME_FLAG) === 'resumed';
};

const isProgressResumeBlocked = () => {
  if (typeof window === 'undefined') return false;
  return window.sessionStorage.getItem(PROGRESS_RESUME_FLAG) === 'blocked';
};

const clearProgressResumeFlag = () => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(PROGRESS_RESUME_FLAG);
};

const SUBMISSION_STATE_VALUES: readonly SubmissionState[] = ['idle', 'saving', 'success', 'error'];
const GEO_STATUS_VALUES: readonly GeoStatus[] = ['idle', 'loading', 'success', 'error'];

const sanitizeGeoCoords = (value: unknown): { lat: number; lng: number } | null => {
  if (!value || typeof value !== 'object') return null;
  const maybeCoords = value as { lat?: unknown; lng?: unknown };
  if (typeof maybeCoords.lat === 'number' && typeof maybeCoords.lng === 'number') {
    return { lat: maybeCoords.lat, lng: maybeCoords.lng };
  }
  return null;
};

function readProgressSnapshot(): ProgressSnapshot | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(PROGRESS_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ProgressSnapshot>;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    if (parsed.version !== PROGRESS_VERSION) {
      return null;
    }

    const toStringValue = (value: unknown, fallback = '') =>
      typeof value === 'string' ? value : fallback;
    const toBooleanValue = (value: unknown, fallback = false) =>
      typeof value === 'boolean' ? value : fallback;
    const toSubmissionState = (value: unknown): SubmissionState =>
      SUBMISSION_STATE_VALUES.includes(value as SubmissionState) ? (value as SubmissionState) : 'idle';
    const toGeoStatus = (value: unknown): GeoStatus =>
      GEO_STATUS_VALUES.includes(value as GeoStatus) ? (value as GeoStatus) : 'idle';

    return {
      version: PROGRESS_VERSION,
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : 0,
      locale: (parsed.locale as Locale) ?? 'ja',
      step: typeof parsed.step === 'number' ? parsed.step : 1,
      placeText: toStringValue(parsed.placeText),
      placeTouched: toBooleanValue(parsed.placeTouched),
      reasonText: toStringValue(parsed.reasonText),
      reasonTouched: toBooleanValue(parsed.reasonTouched),
      actionText: toStringValue(parsed.actionText),
      actionTouched: toBooleanValue(parsed.actionTouched),
      appearanceText: toStringValue(parsed.appearanceText),
      appearanceTouched: toBooleanValue(parsed.appearanceTouched),
      characterName: toStringValue(parsed.characterName),
      selectedEmotions: Array.isArray(parsed.selectedEmotions)
        ? parsed.selectedEmotions.filter((item): item is string => typeof item === 'string')
        : [],
      emotionTouched: toBooleanValue(parsed.emotionTouched),
      geoCoords: sanitizeGeoCoords(parsed.geoCoords),
      geoStatus: toGeoStatus(parsed.geoStatus),
      geoError: typeof parsed.geoError === 'string' ? parsed.geoError : null,
      showCharacterAdjust: toBooleanValue(parsed.showCharacterAdjust),
      submissionState: toSubmissionState(parsed.submissionState),
      submissionError: typeof parsed.submissionError === 'string' ? parsed.submissionError : null,
    } satisfies ProgressSnapshot;
  } catch (error) {
    logWarn('Failed to parse progress snapshot', error);
    return null;
  }
}

function persistProgressSnapshot(snapshot: ProgressSnapshot) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(snapshot));
  } catch (error) {
    logWarn('Failed to persist progress snapshot', error);
  }
}

function clearProgressSnapshot() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(PROGRESS_STORAGE_KEY);
  clearProgressResumeFlag();
}

const NAME_STORAGE_KEY = CHARACTER_NAME_KEY;
const AR_SUMMON_STORAGE_KEY = AR_SUMMON_KEY;

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

  const initialName = useMemo(() => loadSessionString(NAME_STORAGE_KEY), []);
  const [characterName, setCharacterName] = useState(initialName);

  const initialGeoCoords = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const raw = window.sessionStorage.getItem(GEO_COORDS_STORAGE_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as { lat?: number; lng?: number };
      if (typeof parsed?.lat === 'number' && typeof parsed?.lng === 'number') {
        return { lat: parsed.lat, lng: parsed.lng };
      }
    } catch (error) {
      logWarn('Failed to parse stored geo coords', error);
      window.sessionStorage.removeItem(GEO_COORDS_STORAGE_KEY);
    }
    return null;
  }, []);

  const [geoStatus, setGeoStatus] = useState<GeoStatus>(
      initialGeoCoords ? 'success' : 'idle',
    );
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lng: number } | null>(initialGeoCoords);
  const [geoError, setGeoError] = useState<string | null>(null);
  const geocodeTimeoutRef = useRef<number | null>(null);
  const lastGeocodeQueryRef = useRef<string | null>(null);

  const initialEmotions = useMemo(() => {
    const stored = loadSessionArray(EMOTIONS_STORAGE_KEY);
    if (!stored.length) return [] as string[];
    return stored.filter((value) => EMOTION_DEFINITION_MAP[value]);
  }, []);
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>(initialEmotions);
  const [emotionTouched, setEmotionTouched] = useState(initialEmotions.length > 0);
  const emotionValid = selectedEmotions.length > 0;

  const emotionFlowRows = useMemo(() => {
    return EMOTION_GROUPS.map((group) => ({
      ...group,
      items: Array.from({ length: EMOTION_ROW_REPEAT }, () => group.emotions).flat(),
    }));
  }, []);

  const emotionFlowBlocks = useMemo(() => {
    return Array.from({ length: EMOTION_FLOW_REPEAT }, () => emotionFlowRows);
  }, [emotionFlowRows]);

  const storedStageSelection = useMemo(() => readStageSelection(), []);
  const [stageSelection, setStageSelection] = useState<StageOption | null>(
    storedStageSelection?.selectedOption ?? null,
  );
  const [backgroundError, setBackgroundError] = useState<string | null>(null);
  const [backgroundUploading, setBackgroundUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const [showCharacterAdjust, setShowCharacterAdjust] = useState(false);
  const fallbackNameRef = useRef<string | null>(initialName.trim() ? initialName.trim() : null);
  const autoGeoRequestRef = useRef(false);
  const progressLoadedRef = useRef(false);
  const resumePerformedRef = useRef(false);
  const lastProgressStringRef = useRef<string | null>(null);
  const defaultNameExample = useMemo(() => buildDefaultName(), []);

  const emotionFlowContainerRef = useRef<HTMLDivElement | null>(null);
  const emotionFlowTrackRef = useRef<HTMLDivElement | null>(null);

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

  const [storedModelUrl, setStoredModelUrl] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage.getItem(MODEL_URL_STORAGE_KEY);
  });
  const [submissionState, setSubmissionState] = useState<SubmissionState>('idle');
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [progressReady, setProgressReady] = useState(false);

  const progressSerializable = useMemo<ProgressSerializable>(
    () => ({
      locale: localeKey,
      step,
      placeText,
      placeTouched,
      reasonText,
      reasonTouched,
      actionText,
      actionTouched,
      appearanceText,
      appearanceTouched,
      characterName,
      selectedEmotions: [...selectedEmotions],
      emotionTouched,
      geoCoords: geoCoords ? { ...geoCoords } : null,
      geoStatus,
      geoError,
      showCharacterAdjust,
      submissionState,
      submissionError,
    }),
    [
      actionText,
      actionTouched,
      appearanceText,
      appearanceTouched,
      characterName,
      emotionTouched,
      geoCoords,
      geoError,
      geoStatus,
      localeKey,
      placeText,
      placeTouched,
      reasonText,
      reasonTouched,
      selectedEmotions,
      showCharacterAdjust,
      step,
      submissionError,
      submissionState,
    ],
  );

    useEffect(() => {
    if (typeof window === 'undefined') return () => {};

    const syncModelUrl = () => {
      setStoredModelUrl(window.sessionStorage.getItem(MODEL_URL_STORAGE_KEY));
    };

    const syncGenerationPayload = () => {
      const payload = readGenerationPayload();
      setGenerationResults(payload);

      if (!payload) {
        return;
      }

      const hasAnyResult = Boolean(
        payload.results?.model || payload.results?.composite || payload.results?.story,
      );

      if (!hasAnyResult) {
        setGenerationState((prev) => {
          const next: GenerationState = { ...prev };
          let changed = false;

          if (prev.model !== 'complete' && prev.model !== 'error' && prev.model !== 'active') {
            next.model = 'active';
            changed = true;
          }
          if (
            prev.composite !== 'complete' &&
            prev.composite !== 'error' &&
            prev.composite !== 'active'
          ) {
            next.composite = 'active';
            changed = true;
          }
          if (prev.story !== 'complete' && prev.story !== 'error' && prev.story !== 'active') {
            next.story = 'active';
            changed = true;
          }

          return changed ? next : prev;
        });
        setGenerationRunning(true);
      } else if (payload.completedAt) {
        setGenerationRunning(false);
      }
    };

    window.addEventListener(GENERATION_UPDATE_EVENT, syncGenerationPayload);
    window.addEventListener(MODEL_URL_UPDATE_EVENT, syncModelUrl);

    syncModelUrl();
    if (step >= 14) {
      syncGenerationPayload();
    }


    return () => {
      window.removeEventListener(GENERATION_UPDATE_EVENT, syncGenerationPayload);
      window.removeEventListener(MODEL_URL_UPDATE_EVENT, syncModelUrl);
    };
  }, [step]);

    
  useEffect(() => {
    setGenerationResults((prev) => {
      if (!prev || prev.name === characterName) {
        return prev;
      }
      const next = { ...prev, name: characterName } as StoredGenerationPayload;
      persistGenerationPayload(next);
      return next;
    });
  }, [characterName]);

useEffect(() => {
  if (!generationResults) return;
  setGenerationState((prev) => {
    const next: GenerationState = { ...prev };
    let changed = false;

    if (generationResults.results.model && prev.model !== 'complete') {
      next.model = 'complete';
      changed = true;
    }

    if (generationResults.results.composite && prev.composite !== 'complete') {
      next.composite = 'complete';
      changed = true;
    }

    if (generationResults.results.story && prev.story !== 'complete') {
      next.story = 'complete';
      changed = true;
    }

    if (!changed) return prev;
    return next;
  });
}, [generationResults]);

  useEffect(() => {
    if (step !== 1) return;
    setGenerationState(INITIAL_GENERATION_STATE);
    setGenerationError(null);
    setGenerationResults(null);
    setGenerationRunning(false);
    setGenerationLockActive(false);
    releaseGenerationLock();
  }, [step]);

  // ====== やわらかトーンの定型文 ======
  const minLengthHint = isJa ? '何か入力してください' : 'Please enter at least one character.';
  const selectOneHint = isJa ? '少なくとも1つえらんでください' : 'Please select at least one.';
  const characterLoadingTitle = isJa ? 'あなたのエモカイを現像しています…' : 'Shaping your Emokai';
  const characterLoadingMessage = isJa
    ? '場所と感情からエモカイの姿を再構築しています。'
    : 'Letting your Emokai take form from your feelings.';
  const generationPrepMessage = isJa
    ? 'ARモデル、合成画像、物語を順番に仕上げています。しばらくお待ちください。'
    : 'Preparing the AR model, composite image, and story. Please hold on a moment.';
  const getEmotionLabel = useCallback(
    (emotionId: string) => {
      const definition = EMOTION_DEFINITION_MAP[emotionId];
      if (!definition) {
        return emotionId;
      }
      return isJa ? definition.ja : definition.en;
    },
    [isJa],
  );

  const flowSteps = SIMPLIFIED_FLOW_STEPS as ReadonlyArray<number>;

  const previousStep = useMemo(() => {
    const currentIndex = flowSteps.indexOf(step);
    if (currentIndex > 0) {
      return flowSteps[currentIndex - 1];
    }
    return null;
  }, [flowSteps, step]);

  const previousStepPath = useMemo(() => {
    if (!previousStep) return null;
    return `/${locale}/emokai/step/${previousStep}`;
  }, [locale, previousStep]);

  const showBackButton = Boolean(previousStepPath && step !== 10 && step !== 15);

  const handleBack = useCallback(() => {
    blockProgressResume();
    if (previousStepPath) {
      router.push(previousStepPath);
    } else {
      router.back();
    }
  }, [previousStepPath, router]);

  useEffect(() => {
    if (progressLoadedRef.current) return;
    if (typeof window === 'undefined') {
      setProgressReady(true);
      return;
    }
    progressLoadedRef.current = true;
    const snapshot = readProgressSnapshot();
    if (!snapshot) {
      resumePerformedRef.current = false;
      clearProgressResumeFlag();
      setProgressReady(true);
      return;
    }
    const expired = !snapshot.savedAt || Date.now() - snapshot.savedAt > PROGRESS_EXPIRY_MS;
    if (expired || snapshot.locale !== localeKey) {
      clearProgressSnapshot();
      resumePerformedRef.current = false;
      setProgressReady(true);
      return;
    }

    const resumeBlocked = isProgressResumeBlocked();
    const resumeAlreadyHandled = wasProgressResumed() || resumeBlocked;
    resumePerformedRef.current = resumeAlreadyHandled;

    const syncSessionString = (key: string, value: string) => {
      if (value) {
        saveSessionString(key, value);
      } else {
        window.sessionStorage.removeItem(key);
      }
    };

    syncSessionString(PLACE_STORAGE_KEY, snapshot.placeText);
    setPlaceText(snapshot.placeText);
    setPlaceTouched(snapshot.placeTouched ?? Boolean(snapshot.placeText.trim().length));

    syncSessionString(REASON_STORAGE_KEY, snapshot.reasonText);
    setReasonText(snapshot.reasonText);
    setReasonTouched(snapshot.reasonTouched ?? Boolean(snapshot.reasonText.trim().length));

    syncSessionString(ACTION_STORAGE_KEY, snapshot.actionText);
    setActionText(snapshot.actionText);
    setActionTouched(snapshot.actionTouched ?? Boolean(snapshot.actionText.trim().length));

    syncSessionString(APPEARANCE_STORAGE_KEY, snapshot.appearanceText);
    setAppearanceText(snapshot.appearanceText);
    setAppearanceTouched(snapshot.appearanceTouched ?? Boolean(snapshot.appearanceText.trim().length));

    syncSessionString(NAME_STORAGE_KEY, snapshot.characterName);
    setCharacterName(snapshot.characterName);
    fallbackNameRef.current = snapshot.characterName.trim() || null;

    setSelectedEmotions(snapshot.selectedEmotions);
    saveSessionArray(EMOTIONS_STORAGE_KEY, snapshot.selectedEmotions);
    setEmotionTouched(snapshot.emotionTouched ?? snapshot.selectedEmotions.length > 0);

    if (snapshot.geoCoords) {
      setGeoCoords(snapshot.geoCoords);
      window.sessionStorage.setItem(GEO_COORDS_STORAGE_KEY, JSON.stringify(snapshot.geoCoords));
    } else {
      setGeoCoords(null);
      window.sessionStorage.removeItem(GEO_COORDS_STORAGE_KEY);
    }
    setGeoStatus(snapshot.geoStatus);
    setGeoError(snapshot.geoError);

    setShowCharacterAdjust(snapshot.showCharacterAdjust);
    setSubmissionState(snapshot.submissionState);
    setSubmissionError(snapshot.submissionError);

    lastProgressStringRef.current = null;
    setProgressReady(true);

    const savedStep = snapshot.step;
    if (
      !resumeAlreadyHandled &&
      savedStep > 1 &&
      savedStep !== step &&
      savedStep <= TOTAL_STEPS &&
      step === 1 &&
      flowSteps.includes(savedStep)
    ) {
      resumePerformedRef.current = true;
      markProgressResumed();
      router.replace(`/${locale}/emokai/step/${savedStep}`);
      return;
    }

    if (resumeBlocked && step === 1) {
      clearProgressResumeFlag();
    }
  }, [flowSteps, locale, localeKey, router, step]);

  useEffect(() => {
    if (!progressReady) return;
    if (typeof window === 'undefined') return;
    if (submissionState === 'success') {
      clearProgressSnapshot();
      lastProgressStringRef.current = null;
      return;
    }
    const payload: ProgressSnapshot = {
      ...progressSerializable,
      version: PROGRESS_VERSION,
      savedAt: Date.now(),
    };
    const serialized = JSON.stringify(payload);
    if (lastProgressStringRef.current === serialized) {
      return;
    }
    lastProgressStringRef.current = serialized;
    persistProgressSnapshot(payload);
  }, [progressReady, progressSerializable, submissionState]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (media.matches) return;
    const container = emotionFlowContainerRef.current;
    const track = emotionFlowTrackRef.current;
    if (!container || !track) return;
    let rafId: number;
    let lastTimestamp: number | null = null;
    const speed = 12; // px per second
    const loop = (timestamp: number) => {
      if (lastTimestamp !== null) {
        const deltaSeconds = (timestamp - lastTimestamp) / 1000;
        const segmentWidth = track.scrollWidth / Math.max(1, EMOTION_FLOW_REPEAT);
        container.scrollLeft += deltaSeconds * speed;
        if (segmentWidth > 0 && container.scrollLeft >= segmentWidth) {
          container.scrollLeft -= segmentWidth;
        }
      }
      lastTimestamp = timestamp;
      rafId = window.requestAnimationFrame(loop);
    };
    rafId = window.requestAnimationFrame(loop);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    if (flowSteps.includes(step)) return;
    const redirectMap: Record<number, number> = {
      4: 3,
      6: 5,
      7: 9,
      8: 9,
      11: 14,
      12: 14,
      13: 14,
    };
    const fallback = redirectMap[step] ?? 1;
    router.replace(`/${locale}/emokai/step/${fallback}`);
  }, [flowSteps, locale, router, step]);

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

  const characterPrompt = useMemo(() => {
    const lines: string[] = [];
    lines.push(
      localeKey === 'ja'
        ? '以下の情報をもとに、独創的な感情の妖怪『エモカイ』の外見イメージをつくってください。'
        : 'Using the following details, create visual ideas for the 妖怪 pf emotion.',
    );
    const placeHint = placeText.trim();
    lines.push(
      localeKey === 'ja'
        ? placeHint
          ? `環境のヒント: ${placeHint} という場所の空気感や特徴を感じさせてください。ただし地名や文字を直接描写したり、看板やテキストを入れたりしないでください。`
          : '環境のヒント: 場所の空気感を想像して背景設定に活かしてください。'
        : placeHint
            ? `Environment hint: evoke the atmosphere of ${placeHint}, but do not print the place name or any written text/signage in the image.`
            : 'Environment hint: infer a fitting setting and atmosphere, without adding any written text or signage.'
    );
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
        ? '上記の内容を3Dモデルレンダリング風の画像プロンプトへ変換し、キャラクターを正面から描写してください。背景は完全な白 (純白) とし、余計な要素や文字を入れないでください。スタジオの柔らかい照明で、被写体が均一に照らされるようにしてください。'
        : 'Convert the above into an image prompt for a 3D model render of the character from the front. Use a pure white background with no additional elements or text, and light it with soft studio lighting for even illumination.',
    );
    return lines.join('\n');
  }, [localeKey, placeText, reasonText, actionText, appearanceText]);

  const handlePlaceChange = (value: string) => {
    setPlaceTouched(true);
    setPlaceText(value);
    saveSessionString(PLACE_STORAGE_KEY, value);
    setGeoError(null);
    const trimmed = value.trim();
    if (!trimmed) {
      setGeoCoords(null);
      setGeoStatus('idle');
      lastGeocodeQueryRef.current = null;
    } else {
      const parsed = parseCoordinateLabel(trimmed);
      if (parsed) {
        setGeoCoords((prev) => mergeCoordinates(prev, parsed));
        setGeoStatus('success');
        setGeoError(null);
        lastGeocodeQueryRef.current = trimmed;
      } else {
        setGeoStatus('idle');
        lastGeocodeQueryRef.current = null;
      }
    }
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

  const handleCharacterNameChange = (value: string) => {
    setCharacterName(value);
    fallbackNameRef.current = value.trim() || null;
    saveSessionString(NAME_STORAGE_KEY, value);
  };

  const getFallbackName = useCallback(() => {
    if (fallbackNameRef.current) {
      return fallbackNameRef.current;
    }
    const generated = buildDefaultName();
    fallbackNameRef.current = generated;
    return generated;
  }, []);

  const ensureCharacterName = useCallback(() => {
    const trimmed = characterName.trim();
    if (trimmed) {
      fallbackNameRef.current = trimmed;
      return trimmed;
    }

    const stored = generationResults?.name?.trim();
    if (stored) {
      fallbackNameRef.current = stored;
      return stored;
    }

    const generated = getFallbackName();
    setCharacterName(generated);
    saveSessionString(NAME_STORAGE_KEY, generated);
    return generated;
  }, [characterName, generationResults, getFallbackName]);

  useEffect(() => {
    if (initialName.trim()) return;
    setCharacterName(defaultNameExample);
    fallbackNameRef.current = defaultNameExample;
    saveSessionString(NAME_STORAGE_KEY, defaultNameExample);
  }, [defaultNameExample, initialName]);

  const requestGeolocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoStatus('error');
      setGeoError(isJa ? '位置情報が利用できません。' : 'Location services unavailable.');
      return;
    }

    const handleSuccess = (position: GeolocationPosition) => {
      const { latitude, longitude } = position.coords;
      setGeoCoords({ lat: latitude, lng: longitude });
      setGeoStatus('success');
      setGeoError(null);
    };

    const buildErrorMessage = (error: GeolocationPositionError) => {
      if (error.code === 1) {
        return isJa
          ? '位置情報の利用が拒否されました。設定から許可してください。'
          : 'Location permission was denied. Please allow it in Settings.';
      }
      if (error.code === 2) {
        return isJa
          ? '位置情報を取得できませんでした。電波状況の良い場所で再試行してください。'
          : 'Your location is currently unavailable. Try again with better reception.';
      }
      if (error.code === 3) {
        return isJa
          ? '位置情報の取得がタイムアウトしました。もう一度お試しください。'
          : 'Location lookup timed out. Please try again.';
      }
      return (
        error.message ||
        (isJa ? '位置情報を取得できませんでした。' : 'Failed to fetch your location.')
      );
    };

    const handleFailure = (
      error: GeolocationPositionError,
      attemptedFallback: boolean,
    ) => {
      logWarn('Geolocation error', error);
      if (!attemptedFallback) {
        navigator.geolocation.getCurrentPosition(
          handleSuccess,
          (finalError) => handleFailure(finalError, true),
          { enableHighAccuracy: false, timeout: 15_000, maximumAge: 15_000 },
        );
        return;
      }
      setGeoStatus('error');
      setGeoError(buildErrorMessage(error));
    };

    setGeoStatus('loading');
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      (error) => handleFailure(error, false),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 5_000 },
    );
  }, [isJa]);

  const ensureGeoCoordinates = useCallback(async (): Promise<{ lat: number; lng: number } | null> => {
    const trimmed = placeText.trim();

    if (!trimmed) {
      if (geoCoords) {
        return geoCoords;
      }
      return null;
    }

    if (geoCoords) {
      return geoCoords;
    }

    const parsed = parseCoordinateLabel(trimmed);
    if (parsed) {
      setGeoCoords((prev) => mergeCoordinates(prev, parsed));
      setGeoStatus('success');
      setGeoError(null);
      lastGeocodeQueryRef.current = trimmed;
      return parsed;
    }

    try {
      setGeoStatus('loading');
      setGeoError(null);
      const response = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed, locale: localeKey }),
      });
      const data = (await response.json()) as {
        latitude?: number;
        longitude?: number;
        error?: string;
        message?: string;
      };
      if (!response.ok) {
        setGeoStatus('error');
        setGeoError(
          data?.error || data?.message || (isJa ? '場所を特定できませんでした。' : 'Could not locate that place.'),
        );
        return null;
      }
      if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        const resolved = { lat: data.latitude, lng: data.longitude };
        setGeoCoords((prev) => mergeCoordinates(prev, resolved));
        setGeoStatus('success');
        setGeoError(null);
        lastGeocodeQueryRef.current = trimmed;
        return resolved;
      }
      setGeoStatus('error');
      setGeoError(
        data?.error || data?.message || (isJa ? '座標情報が取得できませんでした。' : 'Coordinates missing in response.'),
      );
      return null;
    } catch (error) {
        logWarn('Failed to geocode place immediately', error);
      setGeoStatus('error');
      setGeoError(isJa ? '場所の検索に失敗しました。' : 'Failed to geocode this place.');
      return null;
    }
  }, [geoCoords, isJa, localeKey, placeText]);

  useEffect(() => {
    if (step !== 3) {
      autoGeoRequestRef.current = false;
      return;
    }
    if (geoStatus === 'loading' || geoStatus === 'success') return;
    if (geoCoords) return;
    if (autoGeoRequestRef.current) return;
    autoGeoRequestRef.current = true;
    requestGeolocation();
  }, [geoCoords, geoStatus, requestGeolocation, step]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (geoCoords) {
      window.sessionStorage.setItem(GEO_COORDS_STORAGE_KEY, JSON.stringify(geoCoords));
    } else {
      window.sessionStorage.removeItem(GEO_COORDS_STORAGE_KEY);
    }
  }, [geoCoords]);

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

  const resetAfterBackgroundChange = useCallback(() => {
    setBackgroundError(null);
    setCharacterOptions([]);
    setCharacterSelection(null);
    setCharacterStatus('idle');
    clearCharacterOptions();
    setGenerationResults(null);
    setGenerationState(INITIAL_GENERATION_STATE);
    setGenerationError(null);
    setGenerationRunning(false);
    setGenerationLockActive(false);
    releaseGenerationLock();
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(CHARACTER_SELECTION_KEY);
      window.sessionStorage.removeItem(CHARACTER_OPTIONS_KEY);
      window.sessionStorage.removeItem(GENERATION_RESULTS_KEY);
      window.sessionStorage.removeItem(AR_SUMMON_STORAGE_KEY);
      window.sessionStorage.removeItem(MODEL_URL_STORAGE_KEY);
      window.sessionStorage.removeItem(GEO_COORDS_STORAGE_KEY);
      broadcastClientEvent(GENERATION_UPDATE_EVENT);
      broadcastClientEvent(MODEL_URL_UPDATE_EVENT);
    }
    fallbackNameRef.current = null;
    setStoredModelUrl(null);
  }, []);

  const processBackgroundImage = useCallback(
    async (file: File) => {
      if (!file) return;
      setBackgroundUploading(true);
      setBackgroundError(null);
      try {
        resetAfterBackgroundChange();
        const { base64, mimeType } = await readFileAsBase64(file);
        const optimized = await compressBase64Image({ base64, mimeType }, {
          maxDimension: 1280,
          quality: 0.85,
        });
        const cacheKey = `user-stage-${Date.now().toString(36)}`;
        const previewUrl = cacheImage(cacheKey, optimized.base64, optimized.mimeType);
        const option: StageOption = {
          id: cacheKey,
          cacheKey,
          previewUrl,
          prompt: 'user-photo',
          mimeType: optimized.mimeType,
        };
        setStageSelection(option);
        persistStageSelection(option);
      } catch (error) {
        logError('Failed to process background image', error);
        setBackgroundError(
          isJa
            ? '写真を読み込めませんでした。もう一度お試しください。'
            : 'Unable to load that photo. Please try again.',
        );
      } finally {
        setBackgroundUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        if (cameraInputRef.current) {
          cameraInputRef.current.value = '';
        }
      }
    },
    [isJa, resetAfterBackgroundChange],
  );

  const handleBackgroundFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        void processBackgroundImage(file);
      }
    },
    [processBackgroundImage],
  );

  const handleCameraFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        void processBackgroundImage(file);
      }
    },
    [processBackgroundImage],
  );

  const handleSelectFromLibrary = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleCapturePhoto = useCallback(() => {
    cameraInputRef.current?.click();
  }, []);

  const handleRemoveBackground = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(STAGE_SELECTION_KEY);
    }
    setStageSelection(null);
    resetAfterBackgroundChange();
  }, [resetAfterBackgroundChange]);

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
      logError(error);
      setCharacterGenerationError(
        isJa ? 'うまくいきませんでした。もう一度ためしてください。' : 'Failed to prepare options.',
      );
      setCharacterStatus('error');
      trackError(trackLabel, error);
      return false;
    }
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

  const handleCharacterNext = async () => {
    if (generationRunning) return;
    if (!stageSelection) {
      setBackgroundError(
        isJa ? 'まず場所の写真を用意してください。' : 'Please provide a background photo first.',
      );
      router.push(`/${locale}/emokai/step/2`);
      return;
    }
    if (!characterSelection) {
      setCharacterGenerationError(
        isJa ? 'まだ出会えていません。ひとつ選んでみましょう。' : 'Please choose one.',
      );
      return;
    }
    setShowCharacterAdjust(false);
    if (hasCompletedGeneration) {
      router.push(`/${locale}/emokai/step/14`);
      return;
    }
    const finalName = ensureCharacterName();
    const completed = await startGenerationJobs(finalName);
    if (!completed) {
      return;
    }
    router.push(`/${locale}/emokai/step/14`);
  };

  const handleCharacterApplyAdjust = async () => {
    const success = await handleCharacterRegenerate();
    if (success) {
      setShowCharacterAdjust(false);
    }
  };

  const effectiveCharacterName = useMemo(() => {
    const trimmed = characterName.trim();
    if (trimmed) {
      fallbackNameRef.current = trimmed;
      return trimmed;
    }
    const stored = generationResults?.name?.trim();
    if (stored) {
      fallbackNameRef.current = stored;
      return stored;
    }
    return getFallbackName();
  }, [characterName, generationResults, getFallbackName]);

  const storyEmotionsText = useMemo(() => {
    if (!selectedEmotions.length) {
      return isJa ? '不明' : 'Unknown';
    }
    return selectedEmotions.map((emotion) => getEmotionLabel(emotion)).join(isJa ? '、' : ', ');
  }, [getEmotionLabel, isJa, selectedEmotions]);

  const storyPrompt = useMemo(() => {
    const trimmedPlace = placeText.trim() || (isJa ? '場所不明' : 'Unknown place');
    const trimmedReason = reasonText.trim() || (isJa ? '理由は未記録' : 'Reason not recorded');
    const trimmedAction = actionText.trim() || (isJa ? 'まだ不明なふるまい' : 'No action specified');
    const trimmedAppearance =
      appearanceText.trim() || (isJa ? '姿の手がかりは未記録' : 'Appearance clues missing');

    if (localeKey === 'ja') {
      return [
        'あなたは感情の妖怪「エモカイ」の観測記録をまとめるアーカイビストです。下記の情報をもとに、約350〜450文字の調査ログを作成してください。',
        `観測地点: ${trimmedPlace}`,
        `その地点が帯びる理由: ${trimmedReason}`,
        `観測された情動: ${storyEmotionsText}`,
        `識別名: ${effectiveCharacterName}`,
        `外見的特徴: ${trimmedAppearance}`,
        `主なふるまい: ${trimmedAction}`,
        '',
        '必ず守る事項:',
        '1. 文章は研究ログ風の三段落構成（環境描写→外観と挙動→能力・注意事項）で記述する。',
        `2. ${effectiveCharacterName} は言葉を発しない存在として扱い、会話や鳴き声は記述しない。`,
        '3. 観測者は第三者視点で落ち着いた口調を保ちつつ、印象的な比喩や小エピソードを添えて性質を伝える。',
        '4. 終段では観測者向けの警告、取扱い注意、あるいは記憶に残る締めの一文でまとめる。'
      ].join('\n');
    }

    return [
      'You are compiling a field dossier for the Emokai Observation Bureau. Using the notes below, craft a 350–450 character entry.',
      `Location: ${trimmedPlace}`,
      `Why the site resonates: ${trimmedReason}`,
      `Emotional signature: ${storyEmotionsText}`,
      `Designation: ${effectiveCharacterName}`,
      `Visual traits: ${trimmedAppearance}`,
      `Observed behaviour: ${trimmedAction}`,
      '',
      'Guidelines:',
      '1. Structure the report in three concise paragraphs (environmental context → form & motion → abilities/handling notes).',
      `2. ${effectiveCharacterName} never speaks; describe only physical cues, aura, and influence on surroundings.`,
      '3. Maintain an archival tone—authoritative yet vivid, reminiscent of a bestiary entry.',
      '4. Close with a memorable caution, insight, or lingering image that summarises the encounter.'
    ].join('\n');
  }, [actionText, appearanceText, effectiveCharacterName, isJa, localeKey, placeText, reasonText, storyEmotionsText]);

  const hasCompletedGeneration = useMemo(() => {
    if (!generationResults?.results) return false;
    const { model, composite, story } = generationResults.results;
    return Boolean(model && composite && story);
  }, [generationResults]);

  const characterCtaLabel = useMemo(() => {
    if (generationRunning) {
      return isJa ? '準備中…' : 'Preparing…';
    }
    if (hasCompletedGeneration) {
      return isJa ? '結果へ進む' : 'View results';
    }
    return isJa ? '生成をはじめる' : 'Start generation';
  }, [generationRunning, hasCompletedGeneration, isJa]);

  const startGenerationJobs = useCallback(async (finalName: string): Promise<boolean> => {
    if (generationRunning) {
      return true;
    }

    if (!stageSelection || !characterSelection) {
      setGenerationError(isJa ? 'まだ準備がととのっていません。' : 'Not ready yet.');
      setGenerationState({ model: 'error', composite: 'error', story: 'error' });
      return false;
    }

    const lockAcquired = acquireGenerationLock();
    if (!lockAcquired) {
      setGenerationLockActive(true);
      setGenerationError(
        isJa ? 'いま別の用意をしています。' : 'Another preparation is in progress.',
      );
      return false;
    }

    setGenerationLockActive(true);
    setGenerationRunning(true);
    setGenerationError(null);
    setGenerationState({ model: 'active', composite: 'active', story: 'active' });
    trackEvent('generation_start', { step: 'jobs_step11', locale });

    const initialPayload: StoredGenerationPayload = {
      characterId: characterSelection.id,
      description: characterPrompt,
      name: finalName,
      results: {},
      completedAt: null,
    };
    setGenerationResults(initialPayload);
    persistGenerationPayload(initialPayload);
    fallbackNameRef.current = finalName;

    const runJobs = async (): Promise<boolean> => {
      const release = () => {
        releaseGenerationLock();
        setGenerationLockActive(false);
        setGenerationRunning(false);
      };

      const compositeInstruction = createCompositeInstructionText(actionText, isJa);
      const modelErrorMessage = isJa
        ? '3Dモデルの準備に失敗しました。あとでもう一度ためしてください。'
        : 'We could not prepare the 3D model. Please try again later.';
      const compositeErrorMessage = isJa
        ? '合成画像の生成に失敗しました。'
        : 'Failed to generate the composite image.';
      const storyErrorMessage = isJa
        ? '物語の生成に失敗しました。'
        : 'Failed to generate the story.';

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
                logWarn('Failed to cache composite image', error);
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
            name: base.name ?? finalName,
            results: nextResults,
            completedAt: base.completedAt,
          };

          persistGenerationPayload(nextPayload);
          return nextPayload;
        });
      };

      try {
        const [stageImageRaw, characterImageRaw] = await Promise.all([
          readOptionImagePayload(stageSelection),
          readOptionImagePayload(characterSelection),
        ]);

        if (!stageImageRaw || !characterImageRaw) {
          setGenerationState({ model: 'error', composite: 'error', story: 'error' });
          setGenerationError(
            isJa
              ? '必要な素材を読み込めませんでした。写真をもう一度選び直してください。'
              : 'We could not load the required images. Please reselect your photos and try again.',
          );
          return false;
        }

        const stageInput = {
          cacheKey: stageSelection.cacheKey,
          imageBase64: stageImageRaw.base64,
          mimeType: stageImageRaw.mimeType,
        };

        const characterInput = {
          cacheKey: characterSelection.cacheKey,
          imageBase64: characterImageRaw.base64,
          mimeType: characterImageRaw.mimeType,
        };

    const modelPromise = generateModel({
      characterId: characterSelection.id,
      description: characterPrompt,
      characterImage: characterInput,
      targetFormats: getModelTargetFormats(),
    })
      .then((model) => {
        if (typeof window !== 'undefined') {
          const launchUrl =
            model.alternates?.usdz || model.alternates?.glb || model.url || null;
          if (launchUrl) {
            window.sessionStorage.setItem(MODEL_URL_STORAGE_KEY, launchUrl);
            setStoredModelUrl(launchUrl);
            broadcastClientEvent(MODEL_URL_UPDATE_EVENT);
          }
        }
        setGenerationState((prev) => ({ ...prev, model: 'complete' }));
        mergeResults({ model });
        return model;
      })
          .catch((error) => {
            logError(error);
            setGenerationState((prev) => ({ ...prev, model: 'error' }));
            setGenerationError((prev) => prev ?? modelErrorMessage);
            trackError('jobs_step11_model', error);
            return null;
          });

        const compositePromise = generateComposite(stageInput, characterInput, compositeInstruction)
          .then((composite) => {
            setGenerationState((prev) => ({ ...prev, composite: 'complete' }));
            mergeResults({ composite });
            return composite;
          })
          .catch((error) => {
            logError(error);
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
            logError(error);
            setGenerationState((prev) => ({ ...prev, story: 'error' }));
            setGenerationError((prev) => prev ?? storyErrorMessage);
            trackError('jobs_step11_story', error);
            return null;
          });

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
          return true;
        }
        return false;
      } catch (error) {
        logError(error);
        setGenerationError(
          (prev) =>
            prev ??
            (isJa ? 'うまくいきませんでした。もう一度ためしてください。' : 'Something went wrong.'),
        );
        trackError('jobs_step11', error);
        return false;
      } finally {
        release();
      }
      return false;
    };

    const success = await runJobs();
    return success;
  }, [
    actionText,
    characterPrompt,
    characterSelection,
    generationRunning,
    isJa,
    liveApisEnabled,
    locale,
    localeKey,
    stageSelection,
    storyPrompt,
  ]);

  const handleGenerationRetry = useCallback(() => {
    if (generationRunning) return;
    setGenerationError(null);
    setGenerationState(INITIAL_GENERATION_STATE);
    setGenerationResults(null);
    const candidateName = ensureCharacterName();
    void startGenerationJobs(candidateName);
  }, [ensureCharacterName, generationRunning, startGenerationJobs]);

  const deviceType = useMemo(() => detectDeviceType(), []);
  const isIOS = deviceType === 'ios';
  const modelUrls = useMemo(
    () => extractModelUrls(generationResults?.results?.model ?? null),
    [generationResults],
  );

  const quickLookUrl = useMemo(() => {
    if (modelUrls.usdz) return modelUrls.usdz;
    if (storedModelUrl && storedModelUrl.toLowerCase().endsWith('.usdz')) {
      return storedModelUrl;
    }
    return null;
  }, [modelUrls.usdz, storedModelUrl]);

  const fallbackModelUrl = useMemo(() => {
    if (modelUrls.glb) return modelUrls.glb;
    if (modelUrls.primary && !modelUrls.primary.toLowerCase().endsWith('.usdz')) {
      return modelUrls.primary;
    }
    if (storedModelUrl && !storedModelUrl.toLowerCase().endsWith('.usdz')) {
      return storedModelUrl;
    }
    return null;
  }, [modelUrls.glb, modelUrls.primary, storedModelUrl]);

  const modelAvailable = Boolean(quickLookUrl || fallbackModelUrl);

  useEffect(() => {
    if (step !== 14) return;
    if (typeof window === 'undefined') return;

    const nextUrl = quickLookUrl ?? fallbackModelUrl ?? modelUrls.primary ?? null;
    if (nextUrl) {
      if (storedModelUrl !== nextUrl) {
        window.sessionStorage.setItem(MODEL_URL_STORAGE_KEY, nextUrl);
        setStoredModelUrl(nextUrl);
        broadcastClientEvent(MODEL_URL_UPDATE_EVENT);
      }
      return;
    }

    const modelSettled = generationState.model === 'complete' || generationState.model === 'error';
    if (!modelSettled) {
      return;
    }

    if (storedModelUrl) {
      window.sessionStorage.removeItem(MODEL_URL_STORAGE_KEY);
      setStoredModelUrl(null);
      broadcastClientEvent(MODEL_URL_UPDATE_EVENT);
    }
  }, [
    step,
    quickLookUrl,
    fallbackModelUrl,
    modelUrls.primary,
    storedModelUrl,
    generationState.model,
  ]);

  const compositeReady =
    generationState.composite === 'complete' && !!generationResults?.results?.composite;
  const storyReady = generationState.story === 'complete' && !!generationResults?.results?.story;
  const modelFailed = generationState.model === 'error';
  const compositeFailed = generationState.composite === 'error';
  const storyFailed = generationState.story === 'error';
  const hasGenerationFailure = modelFailed || compositeFailed || storyFailed;
  const otherAssetsPending = !compositeReady || !storyReady;

  useEffect(() => {
    if (step !== 14) return;
    logDebug('[step14] readiness snapshot', {
      generationState,
      modelUrls,
      modelAvailable,
      otherAssetsPending,
      storedModelUrl,
      generationResults,
    });
  }, [step, generationState, modelUrls, modelAvailable, otherAssetsPending, storedModelUrl, generationResults]);

  const handleOpenExperience = useCallback(() => {
    const launchUrl = quickLookUrl ?? fallbackModelUrl;
    if (!launchUrl) return;
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(MODEL_URL_STORAGE_KEY, launchUrl);
    }
    const mode = quickLookUrl ? 'ar' : 'fallback';
    router.push(`/${locale}/ar/session?mode=${mode}`);
  }, [fallbackModelUrl, locale, quickLookUrl, router]);

  const handleProceedToGallery = useCallback(() => {
    router.push(`/${locale}/emokai/step/15`);
  }, [locale, router]);

  const mapEmbedUrl = useMemo(() => {
    const query = mapQuery ?? DEFAULT_COORD_QUERY;
    return `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=16&t=k&output=embed`;
  }, [mapQuery]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!placeTouched) return;
    const trimmed = placeText.trim();
    if (!trimmed) {
      setGeoCoords(null);
      setGeoStatus('idle');
      lastGeocodeQueryRef.current = null;
      return;
    }

    const parsedFromLabel = parseCoordinateLabel(trimmed);
    if (parsedFromLabel) {
      setGeoCoords((prev) => mergeCoordinates(prev, parsedFromLabel));
      setGeoStatus('success');
      setGeoError(null);
      lastGeocodeQueryRef.current = trimmed;
      return;
    }

    if (trimmed.length < 3) return;
    if (trimmed === lastGeocodeQueryRef.current && geoCoords) {
      return;
    }

    if (geocodeTimeoutRef.current) {
      window.clearTimeout(geocodeTimeoutRef.current);
    }

    geocodeTimeoutRef.current = window.setTimeout(async () => {
      try {
        setGeoStatus('loading');
        setGeoError(null);
        const response = await fetch('/api/geocode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: trimmed, locale: localeKey }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          lastGeocodeQueryRef.current = null;
          setGeoStatus('error');
          setGeoError(
            payload?.error || (isJa ? '場所を特定できませんでした。' : 'Could not locate that place.'),
          );
          return;
        }

        const data = (await response.json()) as {
          latitude: number;
          longitude: number;
          formattedAddress?: string | null;
        };

        if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
          setGeoCoords({ lat: data.latitude, lng: data.longitude });
          lastGeocodeQueryRef.current = trimmed;
          setGeoStatus('success');
        } else {
          setGeoStatus('error');
          setGeoError(isJa ? '座標情報が取得できませんでした。' : 'Coordinates missing in response.');
        }
      } catch (error) {
        logWarn('Failed to geocode place', error);
        setGeoStatus('error');
        setGeoError(isJa ? '場所の検索に失敗しました。' : 'Failed to geocode this place.');
      }
    }, 600);

    return () => {
      if (geocodeTimeoutRef.current) {
        window.clearTimeout(geocodeTimeoutRef.current);
      }
    };
  }, [placeText, placeTouched, localeKey, isJa, geoCoords]);

  const emotionLevels = useMemo<EmotionLevelMap>(() => {
    const levels: EmotionLevelMap = {
      joy: 0,
      trust: 0,
      fear: 0,
      surprise: 0,
      sadness: 0,
      disgust: 0,
      anger: 0,
      anticipation: 0,
    };

    EMOTION_GROUPS.forEach((group) => {
      let level = 0;
      const maxIndex = Math.max(1, group.emotions.length - 1);
      group.emotions.forEach((emotion, index) => {
        if (selectedEmotions.includes(emotion.id)) {
          const ratio = index / maxIndex;
          const tier = Math.min(2, Math.floor(ratio * 3));
          const value = Math.max(1, 3 - tier);
          if (value > level) {
            level = value;
          }
        }
      });
      levels[group.plutchikKey] = Math.max(levels[group.plutchikKey], level);
    });

    return levels;
  }, [selectedEmotions]);

  const handleSendOff = useCallback(async () => {
    if (submissionState === 'saving') return;

    if (!stageSelection || !characterSelection || !generationResults) {
      setSubmissionState('error');
      setSubmissionError(
        isJa ? '送信に必要な情報が不足しています。' : 'Some required data is missing for submission.',
      );
      return;
    }

    const compositeResult = generationResults.results.composite;
    if (!compositeResult) {
      setSubmissionState('error');
      setSubmissionError(
        isJa ? '合成画像の準備が完了していません。' : 'Composite image is not available yet.',
      );
      return;
    }

    setSubmissionError(null);
    setSubmissionState('saving');

    const resolvedCoords = await ensureGeoCoordinates();
    const effectiveGeo = resolvedCoords ?? geoCoords;

    try {
      const stageImageRaw = await readOptionImagePayload(stageSelection);
      const characterImageRaw = await readOptionImagePayload(characterSelection);
      if (!stageImageRaw || !characterImageRaw) {
        throw new Error('asset-missing');
      }

      const stageImage =
        'base64' in stageImageRaw
          ? await compressBase64Image(stageImageRaw, { maxDimension: 512, quality: 0.6 })
          : stageImageRaw;
      const characterImage =
        'base64' in characterImageRaw
          ? await compressBase64Image(characterImageRaw, { maxDimension: 512, quality: 0.6 })
          : characterImageRaw;

      const compositePayloadRaw = await readCompositeImagePayload(compositeResult);
      const compositePayload =
        compositePayloadRaw && 'base64' in compositePayloadRaw
          ? await compressBase64Image(compositePayloadRaw, { maxDimension: 640, quality: 0.6 })
          : compositePayloadRaw;
      if (!compositePayload) {
        throw new Error('composite-missing');
      }

      const model = generationResults.results.model;
      const modelPayload = model
        ? {
            primaryUrl: model.url,
            glbUrl: model.alternates?.glb ?? (urlHasExtension(model.url, 'glb') ? model.url : undefined),
            usdzUrl: model.alternates?.usdz ?? (urlHasExtension(model.url, 'usdz') ? model.url : undefined),
            previewUrl: model.previewUrl ?? undefined,
            polygons: model.polygons ?? undefined,
            alternates: model.alternates ?? undefined,
          }
        : undefined;

      const metadata: Record<string, unknown> = {};
      if (generationResults.results.model?.meta) {
        metadata.modelMeta = generationResults.results.model.meta;
      }
      if (generationResults.results.story?.id) {
        metadata.storyId = generationResults.results.story.id;
      }
      if (generationResults.characterId) {
        metadata.characterId = generationResults.characterId;
      }

      const references = {
        stageOptionId: stageSelection.id,
        characterOptionId: characterSelection.id,
        mapQuery: mapQuery ?? undefined,
        stageLocationReference: stageLocationReference ?? undefined,
      };

      const payload = {
        locale: localeKey,
        characterName: effectiveCharacterName,
        story: generationResults.results.story?.content ?? undefined,
        placeDescription: placeText || undefined,
        reasonDescription: reasonText || undefined,
        actionDescription: actionText || undefined,
        appearanceDescription: appearanceText || undefined,
        stagePrompt: stageSelection.prompt,
        characterPrompt,
        compositeInstruction: createCompositeInstructionText(actionText, isJa),
        stageImage,
        characterImage,
        compositeImage:
          'base64' in compositePayload
            ? { base64: compositePayload.base64, mimeType: compositePayload.mimeType }
            : { url: compositePayload.url, mimeType: compositePayload.mimeType },
        emotionLevels,
        geo: effectiveGeo
          ? {
              latitude: effectiveGeo.lat,
              longitude: effectiveGeo.lng,
              altitude: undefined,
            }
          : undefined,
        metadata: Object.keys(metadata).length ? metadata : undefined,
        references,
        model: modelPayload,
        submittedBy: generationResults.characterId || undefined,
      };

      const payloadString = JSON.stringify(payload);
      logDebug('[gallery-submit] payload bytes', payloadString.length);

      const response = await fetch('/api/gallery/submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: payloadString,
      });

      if (!response.ok) {
        let message = isJa
          ? '保存に失敗しました。通信状況をご確認のうえ、もう一度お試しください。'
          : 'We could not save your Emokai. Please check your connection and try again.';
        try {
          const body = await response.json();
          if (typeof body?.error === 'string') {
            message = body.error;
          }
        } catch (error) {
          logWarn('Failed to parse submission error response', error);
        }
        throw new Error(message);
      }

      saveCreation();
      setSubmissionState('success');

      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(AR_SUMMON_STORAGE_KEY);
        window.sessionStorage.removeItem(NAME_STORAGE_KEY);
        window.sessionStorage.removeItem(STAGE_SELECTION_KEY);
        window.sessionStorage.removeItem(CHARACTER_SELECTION_KEY);
        window.sessionStorage.removeItem(CHARACTER_OPTIONS_KEY);
        window.sessionStorage.removeItem(GENERATION_RESULTS_KEY);
        window.sessionStorage.removeItem(MODEL_URL_STORAGE_KEY);
        window.sessionStorage.removeItem(GEO_COORDS_STORAGE_KEY);
        broadcastClientEvent(GENERATION_UPDATE_EVENT);
        broadcastClientEvent(MODEL_URL_UPDATE_EVENT);
      }

      clearProgressSnapshot();
      lastProgressStringRef.current = null;

      clearCharacterOptions();
      setStageSelection(null);
      setCharacterSelection(null);
      setGenerationResults(null);
      setCharacterName('');
      fallbackNameRef.current = null;
      setStoredModelUrl(null);

      router.push(`/${locale}/gallery`);
    } catch (error) {
      logError('[gallery-submit]', error);
      setSubmissionState('error');
      let fallbackMessage =
        isJa
          ? '保存に失敗しました。通信状況をご確認のうえ、もう一度お試しください。'
          : 'We could not save your Emokai. Please check your connection and try again.';
      if (error instanceof Error) {
        fallbackMessage = error.message;
      }

      setSubmissionError(fallbackMessage);

      const retryable = !fallbackMessage.toLowerCase().includes('storage limit');
      if (retryable) {
        setTimeout(() => {
          setSubmissionState('idle');
        }, 2000);
      }
    }
  }, [
    actionText,
    appearanceText,
    characterPrompt,
    characterSelection,
    effectiveCharacterName,
    emotionLevels,
    generationResults,
    geoCoords,
    isJa,
    locale,
    localeKey,
    mapQuery,
    placeText,
    reasonText,
    router,
    stageLocationReference,
    stageSelection,
    submissionState,
    ensureGeoCoordinates,
  ]);


  // ====== 画面パーツ ======

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
      <>
        <section className={`${panelClass} space-y-8 pb-4`}>
        <h2 className="text-base font-semibold text-textPrimary mb-4">
          {isJa ? '出会ったエモカイ' : 'Meet your Emokai'}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {characterOptions.map((option) => (
            <ImageOption
              key={option.id}
              id={option.id}
              selected={characterSelection?.id === option.id}
              onSelect={handleCharacterSelect}
              label={isJa ? 'これにする' : 'Choose this'}
              size="compact"
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
        <div className="flex justify-start pt-3">
          <button
            type="button"
            className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-divider px-5 py-2.5 text-sm text-textSecondary transition hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            onClick={() => setShowCharacterAdjust((prev) => !prev)}
          >
            {isJa ? '調整する' : 'Adjust'}
          </button>
        </div>
        {showCharacterAdjust ? (
          <div className="space-y-3 rounded-2xl border border-divider bg-transparent p-4">
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
                className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-full border border-divider px-5 py-2.5 text-sm text-textSecondary transition hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                onClick={() => setShowCharacterAdjust(false)}
              >
                {isJa ? '閉じる' : 'Close'}
              </button>
            </div>
          </div>
        ) : null}
        {characterGenerationError && !showCharacterAdjust ? (
          <p className="text-xs text-[#ffb9b9]">{characterGenerationError}</p>
        ) : null}
        <RichInput
          label={isJa ? 'エモカイの名前' : 'Name your Emokai'}
          placeholder={isJa ? `例: ${defaultNameExample}` : `e.g. ${defaultNameExample}`}
          value={characterName}
          onChange={handleCharacterNameChange}
          rows={1}
          maxLength={60}
          showCounter={false}
          helperText={
            isJa
              ? `未入力のまま進むと、自動で「${defaultNameExample}」という名前になります。`
              : `Leave it blank and we'll name it "${defaultNameExample}" automatically.`
          }
          error={undefined}
        />
        <div className={ctaWrapperClass}>
          <button
            type="button"
            className={primaryButtonClass}
            onClick={handleCharacterNext}
            disabled={!characterSelection || generationRunning}
          >
            {characterCtaLabel}
          </button>
        </div>
      </section>
      </>
    );
  };

  const renderSummonPanel = () => {
    if (!modelAvailable) {
      const message = generationError
        ? generationError
        : generationState.model === 'active'
          ? isJa
            ? 'AR 用のモデルを準備しています…'
            : 'Preparing the AR model…'
          : isJa
            ? '素材を整理しています…'
            : 'Finalising the materials…';
      return (
        <section className={`${panelClass} space-y-8 text-center`}>
          <div className="flex flex-col items-center space-y-3">
            <img
              src="/loading/creation-loop.gif"
              alt={isJa ? '観測中のアニメーション' : 'Loading animation'}
              className="h-32 w-32 object-contain"
            />
            <h2 className="text-base font-semibold text-textPrimary mb-4">
              {isJa ? '観測中' : 'Observing'}
            </h2>
            <p className="text-sm text-textSecondary">{message}</p>
          </div>
          <p className="text-xs text-textSecondary">
            {isJa
              ? '準備が整いしだい、「つぎへ」ボタンが有効になります。'
              : 'As soon as the model is ready, the Next button will become available.'}
          </p>
        </section>
      );
    }

    if (hasGenerationFailure) {
      return (
        <section className={`${panelClass} space-y-4 p-5 text-center`}>
          <h2 className="text-base font-semibold text-textPrimary mb-4">
            {isJa ? 'もう一度ためしてみましょう' : 'Let’s try again'}
          </h2>
          <p className="text-sm text-textSecondary">
            {generationError ??
              (isJa
                ? '素材が揃いませんでした。時間を置いてから再実行してください。'
                : 'We couldn’t finish preparing everything. Please retry now or come back later.')}
          </p>
          <div className="space-y-2">
            <Button type="button" onClick={handleGenerationRetry} disabled={generationRunning}>
              {generationRunning
                ? isJa
                  ? 'もう一度ためしています…'
                  : 'Retrying...'
                : isJa
                  ? '再生成する'
                  : 'Try again'}
            </Button>
          </div>
          <div className={ctaWrapperClass}>
            <button
              type="button"
              className={primaryButtonClass}
              onClick={handleProceedToGallery}
            >
              {isJa ? '送り出し画面へ進む' : 'Go to send-off'}
            </button>
          </div>
        </section>
      );
    }

    const readyMessage = quickLookUrl
      ? otherAssetsPending
        ? isJa
          ? 'AR モデルは準備できました。他の素材は裏で仕上げています。'
          : 'The AR model is ready. Remaining assets will finish in the background.'
        : isJa
          ? '素材がすべて揃いました。つぎへ進むと呼び出し画面が開きます。'
          : 'All assets are ready. Continue to open the AR/3D viewer.'
      : otherAssetsPending
        ? isJa
          ? '3D ビューア用のモデルを準備しています。まもなく表示できます。'
          : 'Preparing the 3D viewer model. It will be ready shortly.'
        : isJa
          ? 'AR モデルは取得できませんでしたが、3Dビューアで確認できます。'
          : 'AR is unavailable, but you can preview it in the 3D viewer.';

    return (
      <section className={`${panelClass} space-y-4 p-6`}>
        <h2 className="text-base font-semibold text-textPrimary mb-4">
          {isJa ? '準備完了' : 'Ready to launch'}
        </h2>
        <p className="text-sm text-textSecondary">{readyMessage}</p>
        <div className={ctaWrapperClass}>
          <div className="space-y-2">
            <button
              type="button"
              className={primaryButtonClass}
              onClick={handleOpenExperience}
              disabled={!modelAvailable}
            >
              {isJa ? 'つぎへ' : 'Next'}
            </button>
            {!modelAvailable ? (
              <p className="text-xs text-[#ffb9b9]">
                {isJa
                  ? 'モデルのURLを取得できませんでした。Step10に戻って再実行してください。'
                  : 'We could not locate the model URL. Please return to Step 10 and retry.'}
              </p>
            ) : null}
          </div>
        </div>
      </section>
    );
  };

  const renderGalleryStep = () => {
    const sendOffMessage = isJa
      ? `「${effectiveCharacterName}」は旅に出る準備ができました。ギャラリーではいつでも再会できます。`
      : `${effectiveCharacterName} is ready to journey onward. You can revisit them anytime in the gallery.`;
    const isSubmitting = submissionState === 'saving';
    const buttonLabel = isJa
      ? isSubmitting
        ? '送り出しています…'
        : '送り出す'
      : isSubmitting
        ? 'Sending…'
        : 'Send off';

    return (
      <section className={`${panelClass} space-y-6`}>
        <h2 className="text-base font-semibold text-textPrimary mb-4">
          {isJa ? 'エモカイを世界へ送り出す' : 'Send your Emokai off'}
        </h2>
        <p className="text-sm text-textSecondary">{sendOffMessage}</p>
        <div className="aspect-square w-full overflow-hidden rounded-2xl border border-divider bg-transparent">
          {(() => {
            const composite = generationResults?.results.composite;
            if (!composite) return null;
            const url = extractCompositeUrl(composite);
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
        <p className="text-center text-sm text-textSecondary">{isJa ? `「${effectiveCharacterName}」` : effectiveCharacterName}</p>
        <div className={ctaWrapperClass}>
          <button
            type="button"
            className={primaryButtonClass}
            onClick={handleSendOff}
            disabled={isSubmitting}
          >
            {buttonLabel}
          </button>
        </div>
        {submissionError ? (
          <p className="text-xs text-[#ffb9b9]">{submissionError}</p>
        ) : null}
      </section>
    );
  };

// ====== 画面本体 ======

  if (step === 9 && characterStatus === 'generating') {
    return (
      <ScreenBackground>
        <LoadingScreen
          visible
          variant="character"
          title={characterLoadingTitle}
          message={characterLoadingMessage}
          mode="page"
        />
      </ScreenBackground>
    );
  }

  if (step === 10 && characterStatus === 'generating') {
    return (
      <ScreenBackground>
        <LoadingScreen
          visible
          variant="character"
          title={characterLoadingTitle}
          message={characterLoadingMessage}
          mode="page"
        />
      </ScreenBackground>
    );
  }

  if (step === 10 && generationRunning) {
    return (
      <ScreenBackground>
        <LoadingScreen
          visible
          variant="creation"
          title={isJa ? '観測データを整理しています…' : 'Preparing your Emokai…'}
          message={generationPrepMessage}
          mode="page"
        />
      </ScreenBackground>
    );
  }

  const content = (() => {
    switch (step) {
      case 1:
        return (
          <>
            <section className={`${panelClass} space-y-6 pb-10`}>
              <div className="flex justify-center">
                <Image src="/Logo.png" alt="Emokai" width={124} height={60} className="h-[60px] w-auto" priority />
              </div>
              <div className="space-y-4 text-[14px] leading-7 text-textSecondary sm:text-base">
                {isJa
                  ? [
                      '近年、世界各地で感情から生まれた妖怪「エモカイ」の発見が報告されている。エモカイは、人間の情動活動が外的環境に作用し、その場に一時的な情動的構造体として形成される現象と考えられている。',
                      '発生条件は未解明だが、個人の心理状態、場所の記憶、および周囲の社会的・気象的要因との相関が指摘されている。一部の研究機関では、これを「感情生成性存在（Emotionally Generated Entity）」として分類し、出現頻度や共鳴パターンの記録が進められている。',
                      'そして、そのいくつかは——あなた自身から生まれる。',
                      'このアプリは、あなたの内側から生じた感情の痕跡を追跡し、世界のどこかに漂う“あなた由来のエモカイ”を観測するための装置です。どこかで、かつて生まれたエモカイが、今も静かに息づいているかもしれません。',
                    ].map((paragraph) => <p key={paragraph}>{paragraph}</p>)
                  : [
                      'Reports of yokai born from human emotion—known as Emokai—have surfaced across the world. Researchers believe they are emotional constructs that briefly manifest when our inner states resonate with the environment.',
                      'Although the exact conditions remain unclear, strong feelings, memory-rich locations, and surrounding social or meteorological factors seem to play a role. Some institutes classify them as “Emotionally Generated Entities” and document their emergence patterns.',
                      'And a few of them originate from you.',
                      'This app helps you trace those emotional echoes and observe the Emokai that drifts somewhere in the world, born from your own feelings.',
                    ].map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
              <div className="space-y-3 pt-8">
                <button
                  type="button"
                  className={primaryButtonClass}
                  onClick={() => router.push(`/${locale}/emokai/step/2`)}
                >
                  {isJa ? 'エモカイをつくる' : 'Create your Emokai'}
                </button>
                <button
                  type="button"
                  className={secondaryButtonClass}
                  onClick={() => router.push(`/${locale}/gallery`)}
                >
                  {isJa ? 'ほかのエモカイを見る' : "View other people's Emokai"}
                </button>
              </div>
            </section>
          </>
        );
      case 2:
        return (
          <section className={`${panelClass} space-y-6`}>
            <h2 className="text-base font-semibold text-textPrimary mb-4">
              {isJa ? '場所の写真を用意する' : 'Capture the place'}
            </h2>
            <p className="text-sm text-textSecondary">
              {isJa
                ? '今いる場所や思い出の場所を撮影・選択してください。この写真がエモカイの背景になります。'
                : 'Take or select a photo of the place. It will become the backdrop for your Emokai.'}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="button" onClick={handleCapturePhoto} disabled={backgroundUploading}>
                {backgroundUploading
                  ? isJa
                    ? '読み込み中…'
                    : 'Processing…'
                  : isJa
                    ? 'カメラで撮る'
                    : 'Use camera'}
              </Button>
              <button
                type="button"
                className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-full border border-divider px-6 py-2.5 text-sm text-textSecondary transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                onClick={handleSelectFromLibrary}
                disabled={backgroundUploading}
              >
                {isJa ? 'ライブラリから選ぶ' : 'Choose from library'}
              </button>
            </div>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleCameraFileChange}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleBackgroundFileChange}
            />
            {backgroundError ? <p className="text-xs text-[#ffb9b9]">{backgroundError}</p> : null}
            <div className="rounded-3xl border border-divider bg-transparent p-3">
              {stageSelection ? (
                <div className="space-y-3">
                  <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black/10">
                    <img
                      src={stageSelection.previewUrl}
                      alt={isJa ? '選択した場所の写真' : 'Selected background'}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-textSecondary">
                    <span>
                      {isJa
                        ? 'この写真がエモカイの背景として使われます。'
                        : 'This photo will be used as the background.'}
                    </span>
                    <button
                      type="button"
                      className="text-accent underline transition hover:opacity-80"
                      onClick={handleRemoveBackground}
                      disabled={backgroundUploading}
                    >
                      {isJa ? '写真を変更' : 'Change photo'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex h-48 flex-col items-center justify-center space-y-2 text-xs text-textSecondary">
                  <span>{isJa ? 'まだ写真が選ばれていません。' : 'No photo selected yet.'}</span>
                  <span>{isJa ? 'カメラかライブラリから写真を追加してください。' : 'Use the buttons above to add one.'}</span>
                </div>
              )}
            </div>
            <div className={ctaWrapperClass}>
              <button
                type="button"
                className={primaryButtonClass}
                onClick={() => router.push(`/${locale}/emokai/step/3`)}
                disabled={!stageSelection || backgroundUploading}
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
        const canProceedPlaceStep = placeValid || Boolean(geoCoords);

        return (
          <section className={`${panelClass} flex h-full flex-col space-y-4`}>
            <div className="space-y-3">
              <h2 className="text-base font-semibold text-textPrimary mb-4">
                {isJa ? '強い感情がある場所' : 'A place tied to strong feelings'}
              </h2>
              <p className="text-sm text-textSecondary">
                {isJa
                  ? 'あなたにとって、強い感情を感じるような具体的な場所を教えてください。'
                  : 'Tell us about a specific place where you feel something strongly.'}
              </p>
              <div className="space-y-2">
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-textSecondary">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m21 21-4.35-4.35m1.6-4.15a6.75 6.75 0 1 1-13.5 0 6.75 6.75 0 0 1 13.5 0Z"
                      />
                    </svg>
                  </span>
                  <input
                    type="text"
                    className="w-full rounded-full border border-divider bg-transparent pl-11 pr-4 py-3 text-sm text-textPrimary placeholder:text-textSecondary/70 outline-none transition focus:border-accent"
                    placeholder={
                      isJa
                        ? '場所や住所を入力すると地図が移動します。'
                        : 'Type a place or address to move the map.'
                    }
                    value={placeText}
                    onChange={(event) => handlePlaceChange(event.target.value)}
                    maxLength={300}
                  />
                </div>
                {placeTouched && !placeValid && !geoCoords ? (
                  <p className="text-xs text-[#ffb9b9]">{minLengthHint}</p>
                ) : null}
              </div>
            </div>
            <div className="flex h-[320px] flex-col">
              <div className="relative flex-1 overflow-hidden rounded-3xl border border-divider bg-transparent">
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
                        ? '地図を表示できません。上の検索欄に場所を入力してみてください。'
                        : 'Map is unavailable. Try entering the spot in the search bar.'}
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-textSecondary">
                <span>{locationLabel}</span>
                <button
                  type="button"
                  className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-divider px-6 py-2.5 text-sm text-textSecondary transition hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  onClick={requestGeolocation}
                  disabled={geoStatus === 'loading'}
                >
                  {isJa ? '再取得' : 'Retry'}
                </button>
              </div>
            </div>
            <div className={ctaWrapperClass}>
              <button
                type="button"
                className={primaryButtonClass}
                onClick={() => router.push(`/${locale}/emokai/step/5`)}
                disabled={!canProceedPlaceStep}
              >
                {isJa ? 'つづける' : 'Continue'}
              </button>
            </div>
          </section>
        );
      }
      case 5:
        return (
          <section className={`${panelClass} space-y-6`}>
            <h2 className="text-base font-semibold text-textPrimary mb-4">
              {isJa ? 'この場所で感じる気持ち' : 'Feelings in this place'}
            </h2>
            <p className="text-sm text-textSecondary">
              {isJa
                ? '流れてくる言葉のなかから、心当たりのあるものをタップしてください。いくつでも選べます。'
                : 'Tap any drifting tags that resonate with the mood here. Choose as many as you like.'}
            </p>
            <div className="space-y-3 rounded-3xl border border-white/10 bg-[rgba(8,12,24,0.7)] p-4 backdrop-blur">
              <div
                ref={emotionFlowContainerRef}
                className="emotion-flow-container overflow-x-auto rounded-2xl border border-white/10 bg-[rgba(5,9,20,0.35)] px-2 py-3"
              >
                <div ref={emotionFlowTrackRef} className="emotion-flow-track flex w-max gap-6">
                  {emotionFlowBlocks.map((block, blockIndex) => (
                    <div key={`emotion-block-${blockIndex}`} className="space-y-3">
                      {block.map((group) => (
                        <div
                          key={`${blockIndex}-${group.id}`}
                          className="space-y-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 backdrop-blur-sm"
                          style={{ backgroundColor: 'rgba(10,12,25,0.4)' }}
                        >
                          <div className="text-[11px] uppercase tracking-widest text-white/45">
                            {isJa ? group.label.ja : group.label.en}
                          </div>
                          <div className="flex w-max items-center gap-3">
                            {group.items.map((emotion, emotionIndex) => {
                              const selected = selectedEmotions.includes(emotion.id);
                              const palette = EMOTION_COLOR_MAP[emotion.id] ?? DEFAULT_EMOTION_COLORS;
                              const style: CSSProperties = selected
                                ? {
                                    backgroundColor: palette.solid,
                                    color: palette.onSolid,
                                    borderColor: palette.solid,
                                    boxShadow: `0 10px 24px ${palette.solid}2b`,
                                  }
                                : {
                                    borderColor: palette.light,
                                    color: palette.light,
                                    backgroundColor: 'rgba(8, 12, 24, 0.25)',
                                  };
                              const buttonClass = `${emotionButtonClass} ${selected ? 'shadow-lg' : 'opacity-85 hover:opacity-100'}`;
                              return (
                                <button
                                  key={`${blockIndex}-${group.id}-${emotion.id}-${emotionIndex}`}
                                  type="button"
                                  className={buttonClass}
                                  style={style}
                                  onClick={() => toggleEmotion(emotion.id)}
                                >
                                  {getEmotionLabel(emotion.id)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-xs text-textSecondary opacity-80">
              {isJa
                ? '8つの感情レーンが一斉に、とてもゆっくり右から左へ流れ続けます。横スクロールしながら、ぴったり来る言葉をタップしてください。'
                : 'All eight lanes drift together from right to left—swipe sideways and tap any word that fits the mood.'}
            </p>
            {!emotionValid && emotionTouched ? (
              <p className="text-xs text-[#ffb9b9]">
                {isJa ? 'まだ気持ちが映っていません。ひとつ選んでみましょう。' : selectOneHint}
              </p>
            ) : null}
            <div className={ctaWrapperClass}>
              <button
                type="button"
                className={primaryButtonClass}
                onClick={() => {
                  if (!emotionValid) {
                    setEmotionTouched(true);
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
          <section className={`${panelClass} space-y-5`}>
            <h2 className="text-base font-semibold text-textPrimary mb-4">
              {isJa ? 'エモカイのすがた' : "The Emokai's form"}
            </h2>
            <p className="text-sm text-textSecondary">
              {isJa
                ? 'その行動を取るために、エモカイはどのような姿・形をしていますか？'
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
            <div className={ctaWrapperClass}>
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
      case 14:
        return (
          <section className={`${panelClass} space-y-6`}>
            <p className="text-sm text-textSecondary">
              {modelAvailable
                ? isJa
                  ? 'AR起動の準備ができました。'
                  : 'Ready to launch your Emokai in AR.'
                : isJa
                  ? 'エモカイの姿が整うまで、このままお待ちください。'
                  : 'Hold tight while your Emokai finishes materialising.'}
            </p>
            {renderSummonPanel()}
          </section>
        );
      case 15:
        return renderGalleryStep();
      default:
        return null;
    }
  })();

  return (
    <ScreenBackground>
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-8 sm:px-8">
        <div className="flex-1 space-y-8 overflow-y-auto">
          {showBackButton ? (
            <div className="flex justify-start">
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/80 transition hover:border-white/40 hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <span className="sr-only">{isJa ? '前の画面へ' : 'Go back'}</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="h-5 w-5"
                  aria-hidden
                >
                  <path d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </div>
          ) : null}
          {content}
        </div>
      </main>
    </ScreenBackground>
  );
}
