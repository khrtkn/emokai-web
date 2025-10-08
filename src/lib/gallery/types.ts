import type { CreationRow, CreationStatus } from '@/lib/supabase/types';

export type EmotionLevels = {
  joy: number;
  trust: number;
  fear: number;
  surprise: number;
  sadness: number;
  disgust: number;
  anger: number;
  anticipation: number;
};

export type GalleryAssetKind =
  | 'thumbnail'
  | 'composite'
  | 'stage'
  | 'character'
  | 'glb'
  | 'usdz';

function coerceMetadata(value: CreationRow['metadata']): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export interface NormalizedCreation {
  id: string;
  slug: string;
  locale: string;
  status: CreationStatus;
  characterName: string;
  story: string | null;
  placeDescription: string | null;
  reasonDescription: string | null;
  actionDescription: string | null;
  appearanceDescription: string | null;
  stagePrompt: string | null;
  characterPrompt: string | null;
  compositeInstruction: string | null;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  emotionLevels: EmotionLevels;
  metadata: Record<string, unknown>;
  thumbnailPath: string | null;
  compositePath: string | null;
  stageImagePath: string | null;
  characterImagePath: string | null;
  modelGlbPath: string | null;
  modelUsdzPath: string | null;
  submittedAt: string;
  publishedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  moderationNotes: string | null;
  assetsVersion: number;
}

export function mapCreationRow(row: CreationRow): NormalizedCreation {
  return {
    id: row.id,
    slug: row.slug,
    locale: row.locale,
    status: row.status,
    characterName: row.character_name,
    story: row.story,
    placeDescription: row.place_description,
    reasonDescription: row.reason_description,
    actionDescription: row.action_description,
    appearanceDescription: row.appearance_description,
    stagePrompt: row.stage_prompt,
    characterPrompt: row.character_prompt,
    compositeInstruction: row.composite_instruction,
    latitude: row.latitude,
    longitude: row.longitude,
    altitude: row.altitude,
    emotionLevels: {
      joy: Number(row.emotion_joy ?? 0),
      trust: Number(row.emotion_trust ?? 0),
      fear: Number(row.emotion_fear ?? 0),
      surprise: Number(row.emotion_surprise ?? 0),
      sadness: Number(row.emotion_sadness ?? 0),
      disgust: Number(row.emotion_disgust ?? 0),
      anger: Number(row.emotion_anger ?? 0),
      anticipation: Number(row.emotion_anticipation ?? 0)
    },
    metadata: coerceMetadata(row.metadata),
    thumbnailPath: row.thumbnail_path,
    compositePath: row.composite_path,
    stageImagePath: row.stage_image_path,
    characterImagePath: row.character_image_path,
    modelGlbPath: row.model_glb_path,
    modelUsdzPath: row.model_usdz_path,
    submittedAt: row.submitted_at,
    publishedAt: row.published_at,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    moderationNotes: row.moderation_notes,
    assetsVersion: row.assets_version
  };
}
