import { z } from "zod";

const defaultEndpoint =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent";

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

  constructor({ apiKey, endpoint = defaultEndpoint }: GenerateOptions) {
    this.apiKey = apiKey;
    this.endpoint = endpoint;
  }

  async generateStage(request: StageRequest): Promise<GeminiImage[]> {
    const parts: GeminiPart[] = [{ text: `背景（Stage）として生成。${request.prompt}` }];

    if (request.referenceImage) {
      parts.push({
        inline_data: {
          mime_type: request.referenceImage.mimeType,
          data: request.referenceImage.data
        }
      });
    }

    return this.generate(parts);
  }

  async generateCharacter(request: CharacterRequest): Promise<GeminiImage[]> {
    const parts: GeminiPart[] = [{ text: `キャラクター生成。${request.prompt}` }];

    if (request.referenceImage) {
      parts.push({
        inline_data: {
          mime_type: request.referenceImage.mimeType,
          data: request.referenceImage.data
        }
      });
    }

    return this.generate(parts);
  }

  async generateComposite(request: CompositeRequest): Promise<GeminiImage> {
    const parts: GeminiPart[] = [
      {
        text: request.instruction ?? "この人物をこの背景に自然に合成。影・色調整も行う。"
      },
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
      }
    ];

    const images = await this.generate(parts);
    if (!images.length) {
      throw new Error("Gemini composite generation returned no images");
    }
    return images[0];
  }

  private async generate(parts: GeminiPart[]): Promise<GeminiImage[]> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": this.apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts
          }
        ]
      })
    });

    const json = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        (json as { error?: { message?: string } } | null)?.error?.message ?? response.statusText;
      throw new Error(`Gemini API error (${response.status}): ${message}`);
    }

    const parsed = geminiResponseSchema.parse(json);
    const images: GeminiImage[] = [];

    for (const candidate of parsed.candidates) {
      for (const part of candidate.content.parts) {
        if (part.inline_data) {
          images.push({
            mimeType: part.inline_data.mime_type,
            data: part.inline_data.data
          });
        }
      }
    }

    if (!images.length) {
      throw new Error("Gemini response contained no inline image data");
    }

    return images;
  }
}
