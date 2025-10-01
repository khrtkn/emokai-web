import type { Locale } from "@/lib/i18n/messages";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type ModelResult = {
  id: string;
  url: string;
  polygons: number;
};

export type CompositeResult = {
  id: string;
  url: string;
};

export type StoryResult = {
  id: string;
  locale: Locale;
  content: string;
};

export async function generateModel(characterOptionId: string): Promise<ModelResult> {
  // TODO: call TripoAPI for 3D model generation
  await wait(1500);
  return {
    id: characterOptionId,
    url: `/models/${characterOptionId}.fbx`,
    polygons: 4800
  };
}

export async function generateComposite(
  stageSelectionId: string | null,
  characterOptionId: string
): Promise<CompositeResult> {
  // TODO: call Google NanobananaAPI for composite image
  await wait(2000);
  return {
    id: `${stageSelectionId ?? "stage"}-${characterOptionId}`,
    url: `/composites/${characterOptionId}.webp`
  };
}

export async function generateStory(description: string, locale: Locale): Promise<StoryResult> {
  // TODO: call OpenAI API for narrative generation
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
