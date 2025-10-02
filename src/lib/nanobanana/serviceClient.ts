import { z } from 'zod';

// Gemini 2.5 Flash Image Preview (Nano Banana) model
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
type GeminiPart = GeminiTextPart | GeminiInlinePart;

const geminiPartSchema = z.object({
  inline_data: z
    .object({
      mime_type: z.string(),
      data: z.string(),
    })
    .optional(),
  file_data: z
    .object({
      file_uri: z.string(),
      mime_type: z.string().optional(),
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

  constructor({ apiKey, endpoint = defaultEndpoint }: GenerateOptions) {
    this.apiKey = apiKey;
    this.endpoint = endpoint;
    this.filesUrl = filesBaseUrl;
  }

  async generateStage(request: StageRequest): Promise<GeminiImage[]> {
    // Use explicit image generation request as per documentation
    const prompt = `Generate an image of: ${request.prompt}`;

    const parts: GeminiPart[] = [{ text: prompt }];

    if (request.referenceImage) {
      // When there's a reference image, put it first as per docs
      parts.unshift({
        inline_data: {
          mime_type: request.referenceImage.mimeType,
          data: request.referenceImage.data,
        },
      });
      // Update the text prompt to reference the image
      parts[1] = {
        text: `Based on the style of this image, generate a new background/stage image: ${request.prompt}`,
      };
    }

    return this.generateWithRetry(parts, 4);
  }

  async generateCharacter(request: CharacterRequest): Promise<GeminiImage[]> {
    // Use explicit image generation request
    const prompt = `Generate an image of: ${request.prompt}`;

    const parts: GeminiPart[] = [{ text: prompt }];

    if (request.referenceImage) {
      parts.unshift({
        inline_data: {
          mime_type: request.referenceImage.mimeType,
          data: request.referenceImage.data,
        },
      });
      parts[1] = {
        text: `Based on the style of this image, generate a new character image: ${request.prompt}`,
      };
    }

    return this.generateWithRetry(parts, 4);
  }

  async generateComposite(request: CompositeRequest): Promise<GeminiImage> {
    // For composite, images go first, then the instruction
    const parts: GeminiPart[] = [
      {
        inline_data: {
          mime_type: request.background.mimeType,
          data: request.background.data,
        },
      },
      {
        inline_data: {
          mime_type: request.character.mimeType,
          data: request.character.data,
        },
      },
      {
        text:
          request.instruction ??
          'Combine these two images: place the character from the second image onto the background from the first image. Generate a new composite image.',
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

    // Try multiple attempts with the 2.5 endpoint
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const images = await this.generate(parts);
        allImages.push(...images);

        if (allImages.length >= targetCount) {
          return allImages.slice(0, targetCount);
        }
      } catch (error) {
        lastError = error as Error;
        console.warn(`Attempt ${attempt + 1} failed:`, error);

        // If we're getting text instead of images, try more explicit prompting
        if (lastError.message.includes('text instead of an image')) {
          // Modify the prompt to be more explicit
          const textPartIndex = parts.findIndex((p) => 'text' in p);
          if (textPartIndex !== -1) {
            const textPart = parts[textPartIndex] as GeminiTextPart;
            parts[textPartIndex] = {
              text: `Generate an image. Create a visual image. ${textPart.text}. Output an image.`,
            };
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    if (allImages.length === 0 && lastError) {
      throw lastError;
    }

    // If we got some images but not enough, duplicate them
    while (allImages.length < targetCount && allImages.length > 0) {
      allImages.push(allImages[allImages.length - 1]);
    }

    return allImages.slice(0, targetCount);
  }

  private async generate(parts: GeminiPart[]): Promise<GeminiImage[]> {
    const requestBody = {
      contents: [
        {
          role: 'user',
          parts,
        },
      ],
      generationConfig: {
        // Based on official documentation
        responseModalities: ['TEXT', 'IMAGE'],
        candidateCount: 1,
        temperature: 1.0,
        topK: 40,
        topP: 0.95,
      },
    };

    console.log('Gemini API Request to:', this.endpoint);
    const textPart = parts.find((p): p is GeminiTextPart => 'text' in p);
    console.log('Text prompt:', textPart?.text);

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    const json = await response.json().catch(() => null);

    if (!response.ok) {
      console.error('API Error Response:', json);
      const message =
        (json as { error?: { message?: string } } | null)?.error?.message ?? response.statusText;
      throw new Error(`Gemini API error (${response.status}): ${message}`);
    }

    const parsed = geminiResponseSchema.parse(json);
    const images: GeminiImage[] = [];
    let hasText = false;
    let textContent = '';

    for (const candidate of parsed.candidates) {
      for (const part of candidate.content.parts) {
        // Check for inline image data
        const inline = part.inline_data;
        if (inline) {
          console.log('✓ Found inline image data');
          images.push({
            mimeType: inline.mime_type,
            data: inline.data,
          });
        }

        // Check for file URI
        const filePart = part.file_data;
        if (filePart?.file_uri) {
          console.log('✓ Found file URI:', filePart.file_uri);
          try {
            const downloaded = await this.downloadFile(filePart.file_uri);
            images.push(downloaded);
          } catch (error) {
            console.error('File download failed:', error);
          }
        }

        // Track text responses
        if (part.text) {
          hasText = true;
          textContent = part.text;
          console.warn('Text response received:', part.text.slice(0, 100));
        }
      }
    }

    if (!images.length) {
      if (hasText) {
        throw new Error(
          `Gemini returned text instead of an image: "${textContent.slice(0, 200)}". ` +
            `The model may not be generating images for this prompt. ` +
            `Try: 1) Using more explicit image generation language, ` +
            `2) Checking if your API key has access to image generation, ` +
            `3) Verifying that gemini-2.5-flash-image-preview is available in your region.`,
        );
      } else {
        throw new Error('Gemini response contained no inline image data');
      }
    }

    console.log(`✓ Successfully generated ${images.length} image(s)`);
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
    const mimeType: string = metadata?.mime_type ?? 'image/png';

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
