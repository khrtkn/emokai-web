import { ProcessedImage } from "@/lib/image";
import { withRetry } from "@/lib/errors";
import { isLiveApisEnabled } from "@/lib/env/client";

export type StageOption = {
  id: string;
  previewUrl: string;
  prompt: string;
  imageBase64: string;
  mimeType: string;
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
  const base64 = await blobToBase64(processedImage.blob);
  const mimeType = "image/webp";

  if (!isLiveApisEnabled()) {
    return withRetry(async () => {
      await Promise.resolve();

      return Array.from({ length: 4 }).map((_, index) => ({
        id: `${randomId()}-${index + 1}`,
        previewUrl: processedImage.webpUrl,
        prompt: description,
        imageBase64: base64,
        mimeType
      }));
    });
  }

  const response = await fetch("/api/nanobanana/stage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      description,
      referenceImageBase64: base64,
      referenceImageMimeType: mimeType
    })
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

  return options.map((option) => {
    if (!option?.imageBase64 || !option?.mimeType) {
      throw new Error("Nanobanana stage response missing image data");
    }

    return {
      ...option,
      prompt: description
    };
  });
}

function blobToBase64(blob: Blob) {
  const toArrayBuffer = async () => {
    if (typeof blob.arrayBuffer === "function") {
      return blob.arrayBuffer();
    }
    if (typeof blob.text === "function") {
      const text = await blob.text();
      if (typeof TextEncoder !== "undefined") {
        return new TextEncoder().encode(text).buffer;
      }
      const bytes = Array.from(text).map((char) => char.charCodeAt(0));
      return new Uint8Array(bytes).buffer;
    }
    if (typeof Response !== "undefined") {
      const response = new Response(blob);
      return response.arrayBuffer();
    }
    throw new Error("arrayBuffer not supported");
  };

  return toArrayBuffer().then((buffer) => {
    if (typeof Buffer !== "undefined") {
      return Buffer.from(buffer).toString("base64");
    }

    const bytes = new Uint8Array(buffer);
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    if (typeof btoa === "function") {
      return btoa(binary);
    }
    return "";
  });
}
