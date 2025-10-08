import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from './types';
import { getServerEnv } from '@/lib/env';

let cachedClient: SupabaseClient<Database> | null = null;

export function getSupabaseAdminClient(): SupabaseClient<Database> {
  if (cachedClient) {
    return cachedClient;
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();

  cachedClient = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  return cachedClient;
}
