import { z } from "zod";

const serverSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
  TRIPO_API_KEY: z.string().min(1, "TRIPO_API_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  SUPABASE_GALLERY_PRIVATE_BUCKET: z
    .string()
    .min(1, "SUPABASE_GALLERY_PRIVATE_BUCKET is required"),
  SUPABASE_GALLERY_PUBLIC_BUCKET: z
    .string()
    .min(1, "SUPABASE_GALLERY_PUBLIC_BUCKET is required"),
  GALLERY_REVIEWER_TOKEN: z.string().min(1, "GALLERY_REVIEWER_TOKEN is required"),
  GALLERY_REVIEWER_ID: z.string().uuid("GALLERY_REVIEWER_ID must be a valid UUID").optional(),
  GA4_MEASUREMENT_ID: z.string().min(1, "GA4_MEASUREMENT_ID is required"),
  GOOGLE_MAPS_API_KEY: z.string().min(1, "GOOGLE_MAPS_API_KEY is required").optional()
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cachedEnv: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cachedEnv) return cachedEnv;

  const parsed = serverSchema.safeParse({
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    TRIPO_API_KEY: process.env.TRIPO_API_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_GALLERY_PRIVATE_BUCKET: process.env.SUPABASE_GALLERY_PRIVATE_BUCKET,
    SUPABASE_GALLERY_PUBLIC_BUCKET: process.env.SUPABASE_GALLERY_PUBLIC_BUCKET,
    GALLERY_REVIEWER_TOKEN: process.env.GALLERY_REVIEWER_TOKEN,
    GALLERY_REVIEWER_ID: process.env.GALLERY_REVIEWER_ID,
    GA4_MEASUREMENT_ID: process.env.GA4_MEASUREMENT_ID,
    GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY
  });

  if (!parsed.success) {
    throw new Error(`Invalid server environment variables: ${parsed.error.message}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}
