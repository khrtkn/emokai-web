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

function createPlaceholderSvg(text: string, variant: number) {
  const seed = `${text}-${variant}`;
  const hue = Math.abs(Array.from(seed).reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 360;
  const secondary = (hue + 45) % 360;
  const label = text.trim().slice(0, 18) || "Stage";
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'>` +
    `<defs><linearGradient id='grad' x1='0%' y1='0%' x2='100%' y2='100%'>` +
    `<stop offset='0%' stop-color='hsl(${hue},70%,60%)'/>` +
    `<stop offset='100%' stop-color='hsl(${secondary},70%,45%)'/>` +
    `</linearGradient></defs>` +
    `<rect width='512' height='512' fill='url(#grad)'/>` +
    `<text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='54' fill='rgba(0,0,0,0.55)'>${label.replace(/</g, "&lt;")}</text>` +
    `</svg>`;
  const base64 = (() => {
    if (typeof Buffer !== "undefined") {
      return Buffer.from(svg, "utf-8").toString("base64");
    }
    if (typeof btoa === "function") {
      if (typeof TextEncoder !== "undefined") {
        const bytes = new TextEncoder().encode(svg);
        let binary = "";
        bytes.forEach((byte) => {
          binary += String.fromCharCode(byte);
        });
        return btoa(binary);
      }
      const encoded = encodeURIComponent(svg).replace(/%([0-9A-F]{2})/g, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16))
      );
      return btoa(encoded);
    }
    return "";
  })();
  const dataUri = `data:image/svg+xml;base64,${base64}`;
  return { base64, dataUri };
}

export async function createStageOptions(
  description: string,
  processedImage?: ProcessedImage | null
): Promise<StageOption[]> {
  let base64: string | null = null;
  let mimeType = "image/webp";

  if (processedImage) {
    base64 = await blobToBase64(processedImage.blob);
    mimeType = processedImage.blob.type || "image/webp";
  }

  if (!isLiveApisEnabled()) {
    return withRetry(async () => {
      await Promise.resolve();

      return Array.from({ length: 4 }).map((_, index) => {
        if (processedImage) {
          return {
            id: `${randomId()}-${index + 1}`,
            previewUrl: processedImage.webpUrl,
            prompt: description,
            imageBase64: base64!,
            mimeType
          } as StageOption;
        }
        const placeholder = createPlaceholderSvg(description, index);
        return {
          id: `${randomId()}-${index + 1}`,
          previewUrl: placeholder.dataUri,
          prompt: description,
          imageBase64: placeholder.base64,
          mimeType: "image/svg+xml"
        } as StageOption;
      });
    });
  }

  const response = await fetch("/api/nanobanana/stage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      description,
      referenceImageBase64: base64 ?? undefined,
      referenceImageMimeType: base64 ? mimeType : undefined
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
