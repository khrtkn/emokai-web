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
  return withRetry(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1200));

    return Array.from({ length: 4 }).map((_, index) => ({
      id: `${randomId()}-${index + 1}`,
      previewUrl: processedImage.webpUrl,
      prompt: description
    }));
  });
}
