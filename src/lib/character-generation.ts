import { withRetry } from "@/lib/errors";
import { isLiveApisEnabled } from "@/lib/env/client";
import { cacheImage } from "@/lib/image-cache";

export type CharacterOption = {
  id: string;
  previewUrl: string;
  prompt: string;
  mimeType: string;
  cacheKey: string;
};

function toSvgDataUri(seed: string) {
  const hue = Math.abs(Array.from(seed).reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 360;
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'>` +
    `<defs><linearGradient id='grad' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='hsl(${hue},70%,60%)'/><stop offset='100%' stop-color='hsl(${(hue + 60) % 360},70%,40%)'/></linearGradient></defs>` +
    `<rect width='512' height='512' fill='url(#grad)'/>` +
    `<text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='64' fill='rgba(0,0,0,0.6)'>${seed}</text>` +
    `</svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

export async function createCharacterOptions(description: string): Promise<CharacterOption[]> {
  if (!isLiveApisEnabled()) {
    return withRetry(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      return Array.from({ length: 4 }).map((_, index) => {
        const id = `${randomId()}-${index + 1}`;
        const cacheKey = `character-${id}`;
        const base64 = (toSvgDataUri(`${index + 1}`) ?? "").split(",")[1] ?? "";
        const previewUrl = cacheImage(cacheKey, base64, "image/svg+xml");
        return {
          id,
          cacheKey,
          previewUrl,
          prompt: description,
          mimeType: "image/svg+xml"
        } satisfies CharacterOption;
      });
    });
  }

  const response = await fetch("/api/nanobanana/character", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ description })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to generate character options: ${text}`);
  }

  const json = await response.json();
  const options = json?.options as Array<{
    id: string;
    previewUrl: string;
    prompt: string;
    imageBase64: string;
    mimeType: string;
  }> | undefined;

  if (!options || !Array.isArray(options)) {
    throw new Error("Nanobanana character response malformed");
  }

  return options.map((option) => {
    if (!option?.imageBase64 || !option?.mimeType) {
      throw new Error("Nanobanana character response missing image data");
    }

    const cacheKey = `character-${option.id}`;
    const previewUrl = cacheImage(cacheKey, option.imageBase64, option.mimeType);

    return {
      id: option.id,
      cacheKey,
      previewUrl,
      prompt: description,
      mimeType: option.mimeType
    } satisfies CharacterOption;
  });
}
