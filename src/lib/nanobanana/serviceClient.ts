import { z } from "zod";

const defaultEndpoint =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent";
const filesBaseUrl = "https://generativelanguage.googleapis.com/v1beta";

type GeminiInlineImage = {
  mimeType: string;
  data: string;
};

type StageRequest = {
  prompt: string;
  referenceImage?: GeminiInlineImage;
};

type CharacterRequest = {
  prompt: string;
  referenceImage?: GeminiInlineImage;
};

type CompositeRequest = {
  background: GeminiInlineImage;
  character: GeminiInlineImage;
  instruction?: string;
};

type GeminiTextPart = { text: string };
type GeminiInlinePart = { inline_data: { mime_type: string; data: string } };
type GeminiPart = GeminiTextPart | GeminiInlinePart;

const geminiPartSchema = z.object({
  inline_data: z
    .object({
      mime_type: z.string(),
      data: z.string()
    })
    .optional(),
  file_data: z
    .object({
      file_uri: z.string(),
      mime_type: z.string().optional()
    })
    .optional(),
  text: z.string().optional()
});

const geminiResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z.object({
          parts: z.array(geminiPartSchema)
        })
      })
    )
    .min(1)
});

export type GeminiImage = {
  mimeType: string;
  data: string;
};

type GenerateOptions = {
  apiKey: string;
  endpoint?: string;
};

export class NanobananaClient {
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly filesUrl: string;

  constructor({ apiKey, endpoint = defaultEndpoint }: GenerateOptions) {
    this.apiKey = apiKey;
    this.endpoint = endpoint;
    this.filesUrl = filesBaseUrl;
  }

  async generateStage(request: StageRequest): Promise<GeminiImage[]> {
    const parts: GeminiPart[] = [{ text: request.prompt }];

    if (request.referenceImage) {
      parts.unshift({
        inline_data: {
          mime_type: request.referenceImage.mimeType,
          data: request.referenceImage.data
        }
      });
    }

    return this.generateWithRetry(parts, 4);
  }

  async generateCharacter(request: CharacterRequest): Promise<GeminiImage[]> {
    const parts: GeminiPart[] = [{ text: request.prompt }];

    if (request.referenceImage) {
      parts.unshift({
        inline_data: {
          mime_type: request.referenceImage.mimeType,
          data: request.referenceImage.data
        }
      });
    }

    return this.generateWithRetry(parts, 4);
  }

  async generateComposite(request: CompositeRequest): Promise<GeminiImage> {
    const parts: GeminiPart[] = [
      {
        inline_data: {
          mime_type: request.background.mimeType,
          data: request.background.data
        }
      },
      {
        inline_data: {
          mime_type: request.character.mimeType,
          data: request.character.data
        }
      },
      {
        text:
          request.instruction ??
          "Combine these two images: place the character from the second image onto the background from the first image. Generate a new composite image."
      }
    ];

    const images = await this.generateWithRetry(parts, 1);
    if (!images.length) {
      throw new Error("Gemini composite generation returned no images");
    }
    return images[0];
  }

  private async generateWithRetry(parts: GeminiPart[], targetCount: number): Promise<GeminiImage[]> {
    const allImages: GeminiImage[] = [];
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const images = await this.generate(parts);
        allImages.push(...images);

        if (allImages.length >= targetCount) {
          return allImages.slice(0, targetCount);
        }
      } catch (error) {
        lastError = error as Error;
        console.warn(`Gemini generation attempt ${attempt + 1} failed`, error);

        if (
          lastError.message.includes("text instead of an image") ||
          lastError.message.includes("no inline image data")
        ) {
          const textPartIndex = parts.findIndex((part) => "text" in part);
          if (textPartIndex !== -1) {
            const textPart = parts[textPartIndex] as GeminiTextPart;

            if (attempt === 0) {
              parts[textPartIndex] = {
                text: `Generate an image. ${textPart.text} Create and output a photorealistic image.`
              };
            } else if (attempt === 1) {
              parts[textPartIndex] = {
                text: `CREATE A PHOTOREALISTIC IMAGE NOW. ${textPart.text.replace("Generate an image.", "")}`
              };
            }
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    if (allImages.length === 0 && lastError) {
      throw lastError;
    }

    while (allImages.length < targetCount && allImages.length > 0) {
      allImages.push(allImages[allImages.length - 1]);
    }

    return allImages.slice(0, targetCount);
  }

  private async generate(parts: GeminiPart[]): Promise<GeminiImage[]> {
    const textPart = parts.find((part): part is GeminiTextPart => "text" in part);
    const imagePart = parts.find((part): part is GeminiInlinePart => "inline_data" in part);

    let requestBody: unknown;
    if (textPart && !imagePart) {
      requestBody = {
        contents: textPart.text,
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"]
        }
      };
    } else {
      requestBody = {
        contents: [
          {
            role: "user",
            parts
          }
        ],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"]
        }
      };
    }

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": this.apiKey
      },
      body: JSON.stringify(requestBody)
    });

    const json = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        (json as { error?: { message?: string } } | null)?.error?.message ?? response.statusText;
      throw new Error(`Gemini API error (${response.status}): ${message}`);
    }

    const parsed = geminiResponseSchema.parse(json);
    const images: GeminiImage[] = [];
    let textResponse: string | null = null;

    for (const candidate of parsed.candidates) {
      for (const part of candidate.content.parts) {
        const inline = part.inline_data;
        if (inline) {
          images.push({
            mimeType: inline.mime_type,
            data: inline.data
          });
          continue;
        }

        const filePart = part.file_data;
        if (filePart?.file_uri) {
          try {
            const downloaded = await this.downloadFile(filePart.file_uri);
            images.push(downloaded);
          } catch (error) {
            console.error("Gemini file download failed", filePart.file_uri, error);
          }
        }

        if (part.text) {
          textResponse = part.text;
        }
      }
    }

    if (!images.length) {
      if (textResponse) {
        throw new Error(
          `Gemini returned text instead of an image: "${textResponse.slice(0, 200)}". ` +
            "Try using more explicit image generation language or verify your API key has image access."
        );
      }
      throw new Error("Gemini response contained no inline image data");
    }

    return images;
  }

  private async downloadFile(fileUri: string): Promise<GeminiImage> {
    const filePath = fileUri.startsWith("files/") ? fileUri : fileUri.replace(/^.*files\//, "files/");
    const encodedPath = encodeURIComponent(filePath).replace(/%2F/g, "/");
    const keyQuery = `key=${encodeURIComponent(this.apiKey)}`;

    const metadataRes = await fetch(`${this.filesUrl}/${encodedPath}?${keyQuery}`, {
      headers: {
        "x-goog-api-key": this.apiKey
      }
    });

    if (!metadataRes.ok) {
      const text = await metadataRes.text();
      throw new Error(`Gemini file metadata error (${metadataRes.status}): ${text}`);
    }

    const metadata = await metadataRes.json();
    const mimeType: string = metadata?.mime_type ?? "image/png";

    const downloadRes = await fetch(`${this.filesUrl}/${encodedPath}:download?${keyQuery}`, {
      headers: {
        "x-goog-api-key": this.apiKey
      }
    });

    if (!downloadRes.ok) {
      const text = await downloadRes.text();
      throw new Error(`Gemini file download error (${downloadRes.status}): ${text}`);
    }

    const arrayBuffer = await downloadRes.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    return {
      mimeType,
      data: base64
    };
  }
}
