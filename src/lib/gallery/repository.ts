import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import type {
  CreationInsert,
  CreationUpdate,
  CreationAssetInsert,
  CreationRow,
  CreationStatus
} from '@/lib/supabase/types';
import { mapCreationRow, type NormalizedCreation } from './types';

function assertNoError<T>(data: T | null, error: unknown): T {
  if (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
  if (!data) {
    throw new Error('No data returned from Supabase');
  }
  return data;
}

export async function insertCreation(payload: CreationInsert): Promise<NormalizedCreation> {
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from('creations')
    .insert(payload as never)
    .select('*')
    .single();

  const row = assertNoError<CreationRow>(data as CreationRow | null, error);
  return mapCreationRow(row);
}

export async function updateCreation(
  id: string,
  patch: CreationUpdate
): Promise<NormalizedCreation> {
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from('creations')
    .update(patch as never)
    .eq('id', id)
    .select('*')
    .single();

  const row = assertNoError<CreationRow>(data as CreationRow | null, error);
  return mapCreationRow(row);
}

export async function getCreationBySlug(slug: string): Promise<NormalizedCreation | null> {
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from('creations')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
  if (!data) return null;
  return mapCreationRow(data as CreationRow);
}

export async function getCreationById(id: string): Promise<NormalizedCreation | null> {
  const client = getSupabaseAdminClient();
  const { data, error } = await client.from('creations').select('*').eq('id', id).maybeSingle();

  if (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
  if (!data) return null;
  return mapCreationRow(data as CreationRow);
}

export interface ListCreationsOptions {
  status?: CreationStatus;
  locale?: string;
  limit?: number;
  cursor?: string;
  order?: 'submitted_at' | 'published_at';
  ascending?: boolean;
}

export async function listCreations(
  options: ListCreationsOptions = {}
): Promise<{ items: NormalizedCreation[]; nextCursor: string | null }> {
  const { status, locale, limit = 20, cursor, order = 'published_at', ascending = false } = options;
  const client = getSupabaseAdminClient();

  let query = client
    .from('creations')
    .select('*')
    .limit(limit + 1)
    .order(order, { ascending, nullsFirst: ascending });

  if (status) {
    query = query.eq('status', status);
  }

  if (locale) {
    query = query.eq('locale', locale);
  }

  if (cursor) {
    query = query.gt(order, cursor);
  }

  const { data, error } = await query;
  const rows = assertNoError(data as CreationRow[] | null, error);
  const hasMore = rows.length > limit;
  const trimmed = hasMore ? rows.slice(0, -1) : rows;
  const nextCursor = hasMore ? rows[rows.length - 1]?.[order] ?? null : null;

  return {
    items: trimmed.map((row) => mapCreationRow(row as CreationRow)),
    nextCursor: typeof nextCursor === 'string' ? nextCursor : null
  };
}

export async function insertCreationAsset(payload: CreationAssetInsert) {
  const client = getSupabaseAdminClient();
  const { error } = await client.from('creation_assets').insert(payload as never);
  if (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
}

export async function clearCreationAssets(creationId: string) {
  const client = getSupabaseAdminClient();
  const { error } = await client.from('creation_assets').delete().eq('creation_id', creationId);
  if (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
}
