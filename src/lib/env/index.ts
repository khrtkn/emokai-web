import { z } from "zod";

const serverSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  GOOGLE_NANOBANANA_KEY: z.string().min(1, "GOOGLE_NANOBANANA_KEY is required"),
  TRIPO_API_KEY: z.string().min(1, "TRIPO_API_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  GA4_MEASUREMENT_ID: z.string().min(1, "GA4_MEASUREMENT_ID is required")
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cachedEnv: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cachedEnv) return cachedEnv;

  const parsed = serverSchema.safeParse({
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    GOOGLE_NANOBANANA_KEY: process.env.GOOGLE_NANOBANANA_KEY,
    TRIPO_API_KEY: process.env.TRIPO_API_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_URL: process.env.SUPABASE_URL,
    GA4_MEASUREMENT_ID: process.env.GA4_MEASUREMENT_ID
  });

  if (!parsed.success) {
    throw new Error(`Invalid server environment variables: ${parsed.error.message}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}
