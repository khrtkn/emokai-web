import { z } from 'zod';

import { createLogger } from '@/lib/logger';

const defaultEndpoint =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent';
const filesBaseUrl = 'https://generativelanguage.googleapis.com/v1beta';

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
type GeminiInlinePartCamel = { inlineData: { mimeType: string; data: string } };
type GeminiPart = GeminiTextPart | GeminiInlinePart | GeminiInlinePartCamel;

const geminiPartSchema = z.object({
  inline_data: z
    .object({
      mime_type: z.string(),
      data: z.string(),
    })
    .optional(),
  inlineData: z
    .object({
      mimeType: z.string(),
      data: z.string(),
    })
    .optional(),
  file_data: z
    .object({
      file_uri: z.string(),
      mime_type: z.string().optional(),
    })
    .optional(),
  fileData: z
    .object({
      fileUri: z.string(),
      mimeType: z.string().optional(),
    })
    .optional(),
  text: z.string().optional(),
});

const geminiResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z.object({
          parts: z.array(geminiPartSchema),
        }),
      }),
    )
    .min(1),
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
  private readonly logger = createLogger('nanobanana');

  constructor({ apiKey, endpoint = defaultEndpoint }: GenerateOptions) {
    this.apiKey = apiKey;
    this.endpoint = endpoint;
    this.filesUrl = filesBaseUrl;
  }

  async generateStage(request: StageRequest): Promise<GeminiImage[]> {
    // シンプルな画像生成プロンプト（1枚ずつ生成）
    const basePrompt = request.prompt.replace(/\d+枚.*生成.*|生成してください.*$/g, '').trim();
    const prompt = `Generate a photorealistic background image: ${basePrompt}`;

    const parts: GeminiPart[] = [{ text: prompt }];

    if (request.referenceImage) {
      parts.unshift({
        inlineData: {
          mimeType: request.referenceImage.mimeType,
          data: request.referenceImage.data,
        },
      });
    }

    // 1枚ずつ4回生成を試みる
    const images: GeminiImage[] = [];
    for (let i = 0; i < 4; i++) {
      try {
        const result = await this.generate(parts);
        if (result.length > 0) {
          images.push(...result);
          if (images.length >= 4) break;
        }
      } catch (error) {
        this.logger.warn(`Failed to generate image ${i + 1}:`, error);
      }
    }

    // 最低1枚は返す
    if (images.length === 0) {
      throw new Error('Failed to generate any images');
    }

    // 4枚に満たない場合は複製
    while (images.length < 4) {
      images.push(images[0]);
    }

    return images.slice(0, 4);
  }

  async generateCharacter(request: CharacterRequest): Promise<GeminiImage[]> {
    const parts: GeminiPart[] = [{ text: request.prompt }];

    if (request.referenceImage) {
      parts.unshift({
        inlineData: {
          mimeType: request.referenceImage.mimeType,
          data: request.referenceImage.data,
        },
      });
    }

    return this.generateWithRetry(parts, 4);
  }

  async generateComposite(request: CompositeRequest): Promise<GeminiImage> {
    const parts: GeminiPart[] = [
      {
        inlineData: {
          mimeType: request.background.mimeType,
          data: request.background.data,
        },
      },
      {
        inlineData: {
          mimeType: request.character.mimeType,
          data: request.character.data,
        },
      },
      {
        text:
          request.instruction ??
          'Combine these two images: place the character from the second image onto the background from the first image. Match lighting, scale the character appropriately, add a soft contact shadow, and ensure the character feels anchored in the scene.',
      },
    ];

    const images = await this.generateWithRetry(parts, 1);
    if (!images.length) {
      throw new Error('Gemini composite generation returned no images');
    }
    return images[0];
  }

  private async generateWithRetry(
    parts: GeminiPart[],
    targetCount: number,
  ): Promise<GeminiImage[]> {
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
        this.logger.warn(`Gemini generation attempt ${attempt + 1} failed`, error);

        if (
          lastError.message.includes('text instead of an image') ||
          lastError.message.includes('no inline image data')
        ) {
          const textPartIndex = parts.findIndex((part) => 'text' in part);
          if (textPartIndex !== -1) {
            const textPart = parts[textPartIndex] as GeminiTextPart;

            if (attempt === 0) {
              parts[textPartIndex] = {
                text: `Generate an image. ${textPart.text} Create and output a photorealistic image.`,
              };
            } else if (attempt === 1) {
              parts[textPartIndex] = {
                text: `CREATE A PHOTOREALISTIC IMAGE NOW. ${textPart.text.replace('Generate an image.', '')}`,
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
    // contentsは常に配列形式で、partsを含むオブジェクトの配列
    const normalizedParts = parts.map((part) => {
      if ("inline_data" in part) {
        return {
          inlineData: {
            mimeType: part.inline_data.mime_type,
            data: part.inline_data.data,
          },
        };
      }
      if ("inlineData" in part) {
        return {
          inlineData: {
            mimeType: part.inlineData.mimeType,
            data: part.inlineData.data,
          },
        };
      }
      if ("text" in part) {
        return { text: part.text };
      }
      return part;
    });

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: normalizedParts,
        },
      ],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    };

    this.logger.info('Gemini API request');
    this.logger.info('Endpoint', this.endpoint);
    const textPart = parts.find((p): p is GeminiTextPart => 'text' in p);
    if (textPart) {
      this.logger.info('Text prompt', textPart.text);
    }

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    const json = await response.json().catch(() => null);

    this.logger.info('Gemini API response');
    this.logger.info('Status', response.status);

    if (!response.ok) {
      this.logger.error('Error response', json);
      const message =
        (json as { error?: { message?: string } } | null)?.error?.message ?? response.statusText;
      throw new Error(`Gemini API error (${response.status}): ${message}`);
    }

    // レスポンスの構造をログ出力
    this.logger.info('Response structure', {
      hasCandidates: !!json?.candidates,
      candidatesCount: json?.candidates?.length,
      firstCandidate: json?.candidates?.[0]
        ? {
            hasParts: !!json.candidates[0].content?.parts,
            partsCount: json.candidates[0].content?.parts?.length,
            partTypes: json.candidates[0].content?.parts?.map((p: any) => {
              if (p.text) return 'text';
              if (p.inline_data) return 'inline_data';
              if (p.file_data) return 'file_data';
              return 'unknown';
            }),
          }
        : null,
    });

    const parsed = geminiResponseSchema.parse(json);
    const images: GeminiImage[] = [];
    let textResponse: string | null = null;

    for (const candidate of parsed.candidates) {
      for (const part of candidate.content.parts) {
        const inline = part.inline_data || (part.inlineData
          ? { mime_type: part.inlineData.mimeType, data: part.inlineData.data }
          : undefined);
        if (inline) {
          this.logger.info('Found inline image data');
          const mimeType = (inline as any).mime_type ?? (inline as any).mimeType ?? 'image/png';
          images.push({
            mimeType,
            data: (inline as any).data,
          });
          continue;
        }

        const filePart = part.file_data || (part.fileData
          ? { file_uri: part.fileData.fileUri, mime_type: part.fileData.mimeType }
          : undefined);
        if (filePart?.file_uri) {
          this.logger.info('Found file URI', filePart.file_uri);
          try {
            const downloaded = await this.downloadFile(filePart.file_uri);
            images.push(downloaded);
          } catch (error) {
            this.logger.error('Gemini file download failed', filePart.file_uri, error);
          }
        }

        if (part.text) {
          textResponse = part.text;
          this.logger.warn('Text response', part.text);
        }
      }
    }

    if (!images.length) {
      if (textResponse) {
        this.logger.error('Full text response', textResponse);
        throw new Error(
          `Gemini returned text instead of an image: "${textResponse.slice(0, 200)}". ` +
            'Try using more explicit image generation language or verify your API key has image access.',
        );
      }
      throw new Error('Gemini response contained no inline image data');
    }

    this.logger.info(`Generated ${images.length} image(s)`);
    return images;
  }

  private async downloadFile(fileUri: string): Promise<GeminiImage> {
    const filePath = fileUri.startsWith('files/')
      ? fileUri
      : fileUri.replace(/^.*files\//, 'files/');
    const encodedPath = encodeURIComponent(filePath).replace(/%2F/g, '/');
    const keyQuery = `key=${encodeURIComponent(this.apiKey)}`;

    const metadataRes = await fetch(`${this.filesUrl}/${encodedPath}?${keyQuery}`, {
      headers: {
        'x-goog-api-key': this.apiKey,
      },
    });

    if (!metadataRes.ok) {
      const text = await metadataRes.text();
      throw new Error(`Gemini file metadata error (${metadataRes.status}): ${text}`);
    }

    const metadata = await metadataRes.json();
    const mimeType: string = metadata?.mime_type ?? metadata?.mimeType ?? 'image/png';

    const downloadRes = await fetch(`${this.filesUrl}/${encodedPath}:download?${keyQuery}`, {
      headers: {
        'x-goog-api-key': this.apiKey,
      },
    });

    if (!downloadRes.ok) {
      const text = await downloadRes.text();
      throw new Error(`Gemini file download error (${downloadRes.status}): ${text}`);
    }

    const arrayBuffer = await downloadRes.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    return {
      mimeType,
      data: base64,
    };
  }
}
