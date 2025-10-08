-- Create enum for creation status
CREATE EXTENSION IF NOT EXISTS "cube";
CREATE EXTENSION IF NOT EXISTS earthdistance;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'creation_status') THEN
    CREATE TYPE creation_status AS ENUM ('pending', 'published', 'rejected', 'archived');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.creations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  locale TEXT NOT NULL DEFAULT 'ja',
  status creation_status NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  submitted_by TEXT,
  character_name TEXT NOT NULL,
  place_description TEXT,
  reason_description TEXT,
  action_description TEXT,
  appearance_description TEXT,
  story TEXT,
  stage_prompt TEXT,
  character_prompt TEXT,
  composite_instruction TEXT,
  thumbnail_path TEXT,
  composite_path TEXT,
  stage_image_path TEXT,
  character_image_path TEXT,
  model_glb_path TEXT,
  model_usdz_path TEXT,
  emotion_joy SMALLINT NOT NULL DEFAULT 0 CHECK (emotion_joy BETWEEN 0 AND 3),
  emotion_trust SMALLINT NOT NULL DEFAULT 0 CHECK (emotion_trust BETWEEN 0 AND 3),
  emotion_fear SMALLINT NOT NULL DEFAULT 0 CHECK (emotion_fear BETWEEN 0 AND 3),
  emotion_surprise SMALLINT NOT NULL DEFAULT 0 CHECK (emotion_surprise BETWEEN 0 AND 3),
  emotion_sadness SMALLINT NOT NULL DEFAULT 0 CHECK (emotion_sadness BETWEEN 0 AND 3),
  emotion_disgust SMALLINT NOT NULL DEFAULT 0 CHECK (emotion_disgust BETWEEN 0 AND 3),
  emotion_anger SMALLINT NOT NULL DEFAULT 0 CHECK (emotion_anger BETWEEN 0 AND 3),
  emotion_anticipation SMALLINT NOT NULL DEFAULT 0 CHECK (emotion_anticipation BETWEEN 0 AND 3),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  altitude DOUBLE PRECISION,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  moderation_notes TEXT,
  assets_version INTEGER NOT NULL DEFAULT 1,
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.creation_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creation_id UUID NOT NULL REFERENCES public.creations(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  checksum TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.reviewers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE,
  email TEXT UNIQUE,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'reviewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS creations_status_idx ON public.creations(status);
CREATE INDEX IF NOT EXISTS creations_published_at_idx ON public.creations(published_at DESC);
CREATE INDEX IF NOT EXISTS creations_slug_idx ON public.creations(slug);
CREATE INDEX IF NOT EXISTS creations_locale_idx ON public.creations(locale);
CREATE INDEX IF NOT EXISTS creations_geo_idx ON public.creations USING GIST (ll_to_earth(latitude, longitude));

ALTER TABLE public.creations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creation_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviewers ENABLE ROW LEVEL SECURITY;

-- Allow public read of published creations only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'creations'
      AND policyname = 'creations_select_published'
  ) THEN
    EXECUTE 'CREATE POLICY "creations_select_published" ON public.creations FOR SELECT USING (status = ''published'')';
  END IF;
END $$;

-- Restrict all other access to service role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'creations'
      AND policyname = 'creations_service_all'
  ) THEN
    EXECUTE 'CREATE POLICY "creations_service_all" ON public.creations FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'creation_assets'
      AND policyname = 'creation_assets_service_all'
  ) THEN
    EXECUTE 'CREATE POLICY "creation_assets_service_all" ON public.creation_assets FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'reviewers'
      AND policyname = 'reviewers_service_all'
  ) THEN
    EXECUTE 'CREATE POLICY "reviewers_service_all" ON public.reviewers FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')';
  END IF;
END $$;

-- Trigger to maintain updated_at on creation_assets
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS creation_assets_set_updated_at ON public.creation_assets;
CREATE TRIGGER creation_assets_set_updated_at
  BEFORE UPDATE ON public.creation_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
