import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { z } from 'zod';

import {
  copyRemoteAssetToBucket,
  uploadBase64Asset,
  type GalleryBucketScope,
  type UploadResult,
} from '@/lib/gallery/storage';
import { insertCreation, insertCreationAsset } from '@/lib/gallery/repository';
import type { CreationInsert, Json } from '@/lib/supabase/types';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

const emotionLevelsSchema = z.object({
  joy: z.number().min(0).max(3),
  trust: z.number().min(0).max(3),
  fear: z.number().min(0).max(3),
  surprise: z.number().min(0).max(3),
  sadness: z.number().min(0).max(3),
  disgust: z.number().min(0).max(3),
  anger: z.number().min(0).max(3),
  anticipation: z.number().min(0).max(3),
});

const base64AssetSchema = z.object({
  base64: z.string().min(1, 'base64 is required'),
  mimeType: z.string().min(1, 'mimeType is required'),
  cacheKey: z.string().optional(),
  prompt: z.string().optional(),
});

const compositeAssetSchema = z
  .object({
    base64: z.string().min(1).optional(),
    url: z.string().url().optional(),
    mimeType: z.string().min(1),
  })
  .refine((value) => Boolean(value.base64 || value.url), {
    message: 'Either base64 or url is required for compositeImage',
  });

const modelSchema = z
  .object({
    primaryUrl: z.string().url().optional(),
    glbUrl: z.string().url().optional(),
    usdzUrl: z.string().url().optional(),
    previewUrl: z.string().url().optional(),
    polygons: z.number().optional(),
    alternates: z.record(z.unknown()).optional(),
  })
  .optional();

const geoSchema = z
  .object({
    latitude: z.number(),
    longitude: z.number(),
    altitude: z.number().optional().nullable(),
  })
  .optional();

const submissionSchema = z.object({
  locale: z.string().min(1),
  characterName: z.string().min(1),
  story: z.string().optional(),
  placeDescription: z.string().optional(),
  reasonDescription: z.string().optional(),
  actionDescription: z.string().optional(),
  appearanceDescription: z.string().optional(),
  stagePrompt: z.string().optional(),
  characterPrompt: z.string().optional(),
  compositeInstruction: z.string().optional(),
  stageImage: base64AssetSchema,
  characterImage: base64AssetSchema,
  compositeImage: compositeAssetSchema,
  thumbnailImage: base64AssetSchema.optional(),
  emotionLevels: emotionLevelsSchema,
  geo: geoSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
  references: z
    .object({
      stageOptionId: z.string().optional(),
      characterOptionId: z.string().optional(),
      mapQuery: z.string().optional(),
      stageLocationReference: z.string().optional(),
      streetViewDescription: z.string().optional(),
    })
    .optional(),
  model: modelSchema,
  submittedBy: z.string().optional(),
});

type SubmissionPayload = z.infer<typeof submissionSchema>;

type UploadedAsset = UploadResult & { kind: string; scope: GalleryBucketScope };

function slugify(input: string) {
  const normalized = input
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  const trimmed = normalized || 'emokai';
  return trimmed.slice(0, 60);
}

function randomSuffix(length = 4) {
  return Math.random().toString(36).slice(2, 2 + length);
}

async function ensureUniqueSlug(baseName: string): Promise<string> {
  const client = getSupabaseAdminClient();
  const base = slugify(baseName);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = attempt === 0 ? '' : `-${randomSuffix()}`;
    const candidate = `${base}${suffix}`.slice(0, 72);
    const { data } = await client
      .from('creations')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();

    if (!data) {
      return candidate;
    }
  }

  return `${base}-${randomUUID().slice(0, 6)}`.slice(0, 72);
}

function toSmallInt(value: number): number {
  return Math.max(0, Math.min(3, Math.round(value)));
}

function stripBase64Prefix(value: string): string {
  const commaIndex = value.indexOf(',');
  return commaIndex >= 0 ? value.slice(commaIndex + 1) : value;
}

function inferExtension(mimeType: string): string {
  switch (mimeType) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'image/svg+xml':
      return 'svg';
    case 'model/gltf-binary':
    case 'model/glb':
      return 'glb';
    case 'model/vnd.usdz+zip':
    case 'model/usdz+zip':
      return 'usdz';
    default:
      return 'bin';
  }
}

function pruneUndefined<T extends Record<string, unknown>>(input: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  );
}

async function uploadBase64AssetForCreation(
  creationId: string,
  kind: string,
  scope: GalleryBucketScope,
  asset: { base64: string; mimeType: string },
  fileName: string,
  cacheControl?: string,
): Promise<UploadedAsset> {
  const cleanedBase64 = stripBase64Prefix(asset.base64);
  const path = `creations/${creationId}/${fileName}`;
  const upload = await uploadBase64Asset({
    base64: cleanedBase64,
    mimeType: asset.mimeType,
    targetPath: path,
    scope,
    cacheControl,
  });
  return { ...upload, kind, scope };
}

async function copyRemoteAssetForCreation(
  creationId: string,
  kind: string,
  scope: GalleryBucketScope,
  url: string,
  fileName: string,
  cacheControl?: string,
): Promise<UploadedAsset> {
  const path = `creations/${creationId}/${fileName}`;
  const upload = await copyRemoteAssetToBucket({
    sourceUrl: url,
    targetPath: path,
    scope,
    cacheControl,
  });
  return { ...upload, kind, scope };
}

function buildMetadata(payload: SubmissionPayload): Json {
  const base = payload.metadata ?? {};
  const references = payload.references ?? {};
  const model = payload.model
    ? pruneUndefined({
        primaryUrl: payload.model.primaryUrl,
        previewUrl: payload.model.previewUrl,
        polygons: payload.model.polygons,
        alternates: payload.model.alternates,
      })
    : undefined;

  const merged = pruneUndefined({
    ...base,
    mapQuery: references.mapQuery,
    stageOptionId: references.stageOptionId,
    characterOptionId: references.characterOptionId,
    stageLocationReference: references.stageLocationReference,
    streetViewDescription: references.streetViewDescription,
    model,
  });

  return JSON.parse(JSON.stringify(merged ?? {})) as Json;
}

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const submission = submissionSchema.parse(json);

    const creationId = randomUUID();
    const slug = await ensureUniqueSlug(submission.characterName);

    const stageFileName = `stage.${inferExtension(submission.stageImage.mimeType)}`;
    const characterFileName = `character.${inferExtension(submission.characterImage.mimeType)}`;
    const compositeFileName = `composite.${inferExtension(submission.compositeImage.mimeType)}`;

    const uploadedAssets: UploadedAsset[] = [];

    const stageAsset = await uploadBase64AssetForCreation(
      creationId,
      'stage',
      'private',
      submission.stageImage,
      stageFileName,
    );
    uploadedAssets.push(stageAsset);

    const characterAsset = await uploadBase64AssetForCreation(
      creationId,
      'character',
      'private',
      submission.characterImage,
      characterFileName,
    );
    uploadedAssets.push(characterAsset);

    let compositeAsset: UploadedAsset;
    if (submission.compositeImage.base64) {
      compositeAsset = await uploadBase64AssetForCreation(
        creationId,
        'composite',
        'private',
        {
          base64: submission.compositeImage.base64,
          mimeType: submission.compositeImage.mimeType,
        },
        compositeFileName,
      );
    } else {
      compositeAsset = await copyRemoteAssetForCreation(
        creationId,
        'composite',
        'private',
        submission.compositeImage.url!,
        compositeFileName,
      );
    }
    uploadedAssets.push(compositeAsset);

    let thumbnailAsset: UploadedAsset | null = null;
    if (submission.thumbnailImage) {
      const thumbnailFileName = `thumb.${inferExtension(submission.thumbnailImage.mimeType)}`;
      thumbnailAsset = await uploadBase64AssetForCreation(
        creationId,
        'thumbnail',
        'public',
        submission.thumbnailImage,
        thumbnailFileName,
        '86400',
      );
      uploadedAssets.push(thumbnailAsset);
    }

    let modelGlbAsset: UploadedAsset | null = null;
    let modelUsdzAsset: UploadedAsset | null = null;

    if (submission.model?.glbUrl) {
      modelGlbAsset = await copyRemoteAssetForCreation(
        creationId,
        'glb',
        'private',
        submission.model.glbUrl,
        'model/model.glb',
        '31536000',
      );
      uploadedAssets.push(modelGlbAsset);
    }

    if (submission.model?.usdzUrl) {
      modelUsdzAsset = await copyRemoteAssetForCreation(
        creationId,
        'usdz',
        'private',
        submission.model.usdzUrl,
        'model/model.usdz',
        '31536000',
      );
      uploadedAssets.push(modelUsdzAsset);
    }

    const creationPayload: CreationInsert = {
      id: creationId,
      slug,
      locale: submission.locale,
      status: 'pending',
      character_name: submission.characterName,
      story: submission.story ?? null,
      place_description: submission.placeDescription ?? null,
      reason_description: submission.reasonDescription ?? null,
      action_description: submission.actionDescription ?? null,
      appearance_description: submission.appearanceDescription ?? null,
      stage_prompt: submission.stagePrompt ?? null,
      character_prompt: submission.characterPrompt ?? null,
      composite_instruction: submission.compositeInstruction ?? null,
      stage_image_path: stageAsset.path,
      character_image_path: characterAsset.path,
      composite_path: compositeAsset.path,
      thumbnail_path: thumbnailAsset?.path ?? null,
      model_glb_path: modelGlbAsset?.path ?? null,
      model_usdz_path: modelUsdzAsset?.path ?? null,
      emotion_joy: toSmallInt(submission.emotionLevels.joy),
      emotion_trust: toSmallInt(submission.emotionLevels.trust),
      emotion_fear: toSmallInt(submission.emotionLevels.fear),
      emotion_surprise: toSmallInt(submission.emotionLevels.surprise),
      emotion_sadness: toSmallInt(submission.emotionLevels.sadness),
      emotion_disgust: toSmallInt(submission.emotionLevels.disgust),
      emotion_anger: toSmallInt(submission.emotionLevels.anger),
      emotion_anticipation: toSmallInt(submission.emotionLevels.anticipation),
      latitude: submission.geo?.latitude ?? null,
      longitude: submission.geo?.longitude ?? null,
      altitude: submission.geo?.altitude ?? null,
      metadata: buildMetadata(submission),
      submitted_by: submission.submittedBy ?? null,
      assets_version: 1,
    };

    const creation = await insertCreation(creationPayload);

    await Promise.all(
      uploadedAssets.map((asset) =>
        insertCreationAsset({
          creation_id: creation.id,
          kind: asset.kind,
          storage_path: asset.path,
          mime_type: asset.contentType,
          size_bytes: asset.size,
          checksum: asset.checksum,
        }),
      ),
    );

    return NextResponse.json(
      {
        id: creation.id,
        slug: creation.slug,
        status: creation.status,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid payload', details: error.issues },
        { status: 400 },
      );
    }

    console.error('[gallery-submission]', error);
    return NextResponse.json(
      { error: 'Failed to store creation' },
      { status: 500 },
    );
  }
}
