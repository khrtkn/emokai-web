import type { Locale } from "@/lib/i18n/messages";
import { isLiveApisEnabled } from "@/lib/env/client";
import { base64ToBlob } from "@/lib/image-cache";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type ModelResult = {
  id: string;
  url: string;
  polygons: number | null;
  previewUrl: string | null;
  meta: Record<string, unknown> | null;
  alternates?: {
    usdz?: string | null;
  };
};

export type CompositeResult = {
  id: string;
  url: string;
  mimeType: string;
  imageBase64?: string;
  cacheKey?: string;
};

export type StoryResult = {
  id: string;
  locale: Locale;
  content: string;
};

type CompositeInput = {
  cacheKey?: string;
  imageBase64?: string;
  mimeType: string;
};

type ModelInput = {
  characterId: string;
  description: string;
  characterImage?: CompositeInput;
};

export async function generateModel(input: ModelInput): Promise<ModelResult> {
  if (!isLiveApisEnabled()) {
    await wait(1500);
    return {
      id: input.characterId,
      url: `/models/${input.characterId}.fbx`,
      polygons: 4800,
      previewUrl: null,
      meta: null
    };
  }

  const response = await fetch("/api/tripo/model", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      characterId: input.characterId,
      description: input.description,
      characterImage: buildCharacterImagePayload(input.characterImage)
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to generate model: ${text}`);
  }

  const json = await response.json();
  const model = json?.model as ModelResult | undefined;

  if (!model || typeof model.id !== "string" || typeof model.url !== "string") {
    throw new Error("Tripo model response malformed");
  }

  return {
    id: model.id,
    url: model.url,
    polygons: typeof model.polygons === "number" ? model.polygons : null,
    previewUrl: model.previewUrl ?? null,
    meta: model.meta ?? null,
    alternates: model.alternates
  };
}

export async function generateComposite(
  stage: CompositeInput | null,
  character: CompositeInput
): Promise<CompositeResult> {
  if (!isLiveApisEnabled()) {
    await wait(2000);
    const mimeType = character.mimeType;
    const imageBase64 = character.imageBase64;
    if (!imageBase64) {
      throw new Error('Composite image data missing for stub generation');
    }
    return {
      id: `${Date.now()}`,
      url: `data:${mimeType};base64,${imageBase64}`,
      imageBase64,
      mimeType
    };
  }

  if (!stage) {
    throw new Error("Stage selection missing for composite generation");
  }

  const response = await fetch("/api/nanobanana/composite", {
    method: "POST",
    body: buildCompositeFormData(stage, character)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to generate composite: ${text}`);
  }

  const json = await response.json();
  const composite = json?.composite as CompositeResult | undefined;

  if (
    !composite ||
    typeof composite.id !== "string" ||
    typeof composite.url !== "string" ||
    typeof composite.imageBase64 !== "string" ||
    typeof composite.mimeType !== "string"
  ) {
    throw new Error("Nanobanana composite response malformed");
  }

  return composite;
}

function buildCompositeFormData(stage: CompositeInput, character: CompositeInput) {
  const form = new FormData();

  appendImage(form, "background", stage);
  appendImage(form, "character", character);

  return form;
}

function appendImage(form: FormData, field: string, input: CompositeInput) {
  if (!input.imageBase64) {
    throw new Error(`Missing image data for ${field}`);
  }

  const blob = base64ToBlob(input.imageBase64, input.mimeType);
  const fileName = `${field}.${inferExtension(input.mimeType)}`;
  form.append(field, blob, fileName);
  form.append(`${field}MimeType`, input.mimeType);
  if (input.cacheKey) {
    form.append(`${field}CacheKey`, input.cacheKey);
  }
}

function buildCharacterImagePayload(input?: CompositeInput) {
  if (!input) return undefined;

  return {
    imageBase64: input.imageBase64,
    mimeType: input.mimeType,
    cacheKey: input.cacheKey,
  };
}

function inferExtension(mimeType: string) {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/webp":
      return "webp";
    default:
      return "img";
  }
}

export async function generateStory(description: string, locale: Locale): Promise<StoryResult> {
  if (!isLiveApisEnabled()) {
    await wait(800);
    const base =
      locale === "ja"
        ? "これはプロトタイプの物語です。キャラクターは星屑から生まれ、心優しくも勇敢な性格を持っています。"
        : "This is a prototype story. The character was born from stardust and carries a kind yet brave heart.";
    return {
      id: `${locale}-${Date.now()}`,
      locale,
      content: base
    };
  }

  const response = await fetch("/api/openai/story", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ description, locale })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to generate story: ${text}`);
  }

  const json = await response.json();
  const story = json?.story as StoryResult | undefined;

  if (!story || typeof story.id !== "string" || typeof story.content !== "string") {
    throw new Error("OpenAI story response malformed");
  }

  return story;
}
