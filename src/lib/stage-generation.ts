import { ProcessedImage } from "@/lib/image";
import { withRetry } from "@/lib/errors";

export type StageOption = {
  id: string;
  previewUrl: string;
  prompt: string;
};

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

export async function createStageOptions(
  description: string,
  processedImage: ProcessedImage
): Promise<StageOption[]> {
  const useLiveApis = process.env.NEXT_PUBLIC_USE_APIS === "true";

  if (!useLiveApis) {
    return withRetry(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1200));

      return Array.from({ length: 4 }).map((_, index) => ({
        id: `${randomId()}-${index + 1}`,
        previewUrl: processedImage.webpUrl,
        prompt: description
      }));
    });
  }

  const imageBase64 = await blobToBase64(processedImage.blob);

  const response = await fetch("/api/nanobanana/stage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ description, referenceImageBase64: imageBase64 })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to generate stage options: ${text}`);
  }

  const json = await response.json();
  const options = json?.options as StageOption[] | undefined;

  if (!options || !Array.isArray(options)) {
    throw new Error("Nanobanana stage response malformed");
  }

  return options.map((option) => ({ ...option, prompt: description }));
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === "string") {
        resolve(result.split(",")[1] ?? "");
      } else {
        reject(new Error("Failed to convert blob to base64"));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
