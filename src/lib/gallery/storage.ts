import { createHash } from 'crypto';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { getServerEnv } from '@/lib/env';

export type GalleryBucketScope = 'public' | 'private';

export interface UploadResult {
  path: string;
  size: number;
  checksum: string;
  contentType: string | null;
}

export interface CopyRemoteAssetOptions {
  sourceUrl: string;
  targetPath: string;
  scope: GalleryBucketScope;
  headers?: Record<string, string>;
  cacheControl?: string;
}

export interface UploadBase64AssetOptions {
  base64: string;
  mimeType: string;
  targetPath: string;
  scope: GalleryBucketScope;
  cacheControl?: string;
}

async function downloadAsset(
  url: string,
  headers?: Record<string, string>
): Promise<{ buffer: ArrayBuffer; contentType: string | null }> {
  const response = await fetch(url, {
    headers,
    redirect: 'follow'
  });

  if (!response.ok) {
    throw new Error(`Failed to download asset: ${response.status} ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  const contentType = response.headers.get('content-type');
  return { buffer, contentType };
}

function getBucketName(scope: GalleryBucketScope) {
  const env = getServerEnv();
  return scope === 'public'
    ? env.SUPABASE_GALLERY_PUBLIC_BUCKET
    : env.SUPABASE_GALLERY_PRIVATE_BUCKET;
}

export async function copyRemoteAssetToBucket(
  options: CopyRemoteAssetOptions
): Promise<UploadResult> {
  const { sourceUrl, targetPath, scope, headers, cacheControl } = options;
  const { buffer, contentType } = await downloadAsset(sourceUrl, headers);
  const hash = createHash('sha256').update(Buffer.from(buffer)).digest('hex');
  const size = buffer.byteLength;

  const client = getSupabaseAdminClient();
  const bucket = getBucketName(scope);
  const upload = await client.storage.from(bucket).upload(targetPath, Buffer.from(buffer), {
    contentType: contentType ?? undefined,
    upsert: true,
    cacheControl: cacheControl ?? '3600'
  });

  if (upload.error) {
    throw upload.error;
  }

  return {
    path: targetPath,
    size,
    checksum: hash,
    contentType: contentType ?? null
  };
}

export async function uploadBase64Asset(
  options: UploadBase64AssetOptions
): Promise<UploadResult> {
  const { base64, mimeType, targetPath, scope, cacheControl } = options;
  const binary = Buffer.from(base64, 'base64');

  const hash = createHash('sha256').update(binary).digest('hex');
  const size = binary.byteLength;

  const client = getSupabaseAdminClient();
  const bucket = getBucketName(scope);
  const upload = await client.storage.from(bucket).upload(targetPath, binary, {
    contentType: mimeType,
    upsert: true,
    cacheControl: cacheControl ?? '3600'
  });

  if (upload.error) {
    throw upload.error;
  }

  return {
    path: targetPath,
    size,
    checksum: hash,
    contentType: mimeType ?? null
  };
}

export function buildPublicAssetUrl(path: string): string {
  const env = getServerEnv();
  const bucket = env.SUPABASE_GALLERY_PUBLIC_BUCKET;
  return `${env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

export async function createSignedAssetUrl(
  path: string,
  options: { scope: GalleryBucketScope; expiresIn?: number }
): Promise<string> {
  const client = getSupabaseAdminClient();
  const bucket = getBucketName(options.scope);
  const expiresIn = options.expiresIn ?? 60 * 5;
  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn, { download: true });

  if (error || !data?.signedUrl) {
    throw error ?? new Error('Failed to create signed URL');
  }

  return data.signedUrl;
}

export async function removeAsset(path: string, scope: GalleryBucketScope) {
  const client = getSupabaseAdminClient();
  const bucket = getBucketName(scope);
  const { error } = await client.storage.from(bucket).remove([path]);
  if (error) {
    throw error;
  }
}

export async function copyAssetBetweenBuckets(params: {
  sourceScope: GalleryBucketScope;
  sourcePath: string;
  targetScope: GalleryBucketScope;
  targetPath: string;
  cacheControl?: string;
}): Promise<UploadResult> {
  const client = getSupabaseAdminClient();
  const sourceBucket = getBucketName(params.sourceScope);
  const targetBucket = getBucketName(params.targetScope);

  const { data, error } = await client.storage.from(sourceBucket).download(params.sourcePath);
  if (error || !data) {
    throw error ?? new Error('Failed to download source asset');
  }

  const arrayBuffer = await data.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const hash = createHash('sha256').update(buffer).digest('hex');

  const upload = await client.storage.from(targetBucket).upload(params.targetPath, buffer, {
    cacheControl: params.cacheControl ?? '3600',
    upsert: true,
    contentType: data.type || undefined,
  });

  if (upload.error) {
    throw upload.error;
  }

  return {
    path: params.targetPath,
    size: buffer.byteLength,
    checksum: hash,
    contentType: data.type || null,
  };
}
