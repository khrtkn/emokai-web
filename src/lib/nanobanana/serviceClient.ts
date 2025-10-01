import { z } from "zod";

const defaultBaseUrl = "https://api.nanobanana.com/v1";

type FetcherConfig = {
  apiKey: string;
  baseUrl?: string;
};

type StageRequest = {
  prompt: string;
  referenceImageBase64?: string;
};

type CharacterRequest = {
  prompt: string;
};

type CompositeRequest = {
  stageId?: string | null;
  characterId: string;
};

const imageResponseSchema = z.object({
  id: z.string(),
  url: z.string().url()
});

const stageResponseSchema = z.object({
  data: z.array(imageResponseSchema)
});

const characterResponseSchema = z.object({
  data: z.array(imageResponseSchema)
});

const compositeResponseSchema = z.object({
  data: imageResponseSchema
});

export type NanobananaImage = z.infer<typeof imageResponseSchema>;

export class NanobananaClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor({ apiKey, baseUrl = defaultBaseUrl }: FetcherConfig) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private async post<T>(path: string, body: unknown, schema: z.ZodSchema<T>): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Nanobanana API error (${res.status}): ${text}`);
    }

    const json = await res.json();
    return schema.parse(json);
  }

  async generateStage(request: StageRequest): Promise<NanobananaImage[]> {
    const response = await this.post("/stage/generate", request, stageResponseSchema);
    return response.data;
  }

  async generateCharacter(request: CharacterRequest): Promise<NanobananaImage[]> {
    const response = await this.post("/character/generate", request, characterResponseSchema);
    return response.data;
  }

  async generateComposite(request: CompositeRequest): Promise<NanobananaImage> {
    const response = await this.post("/composite/generate", request, compositeResponseSchema);
    return response.data;
  }
}

