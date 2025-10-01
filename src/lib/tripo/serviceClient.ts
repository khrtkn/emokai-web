import { z } from "zod";

const defaultBaseUrl = "https://api.tripo.com/v1";

type FetcherConfig = {
  apiKey: string;
  baseUrl?: string;
};

type ModelRequest = {
  characterId: string;
};

const modelResponseSchema = z.object({
  data: z.object({
    id: z.string(),
    url: z.string().url(),
    polygons: z.number().int().positive()
  })
});

export type TripoModel = z.infer<typeof modelResponseSchema>["data"];

export class TripoClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

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
      throw new Error(`Tripo API error (${res.status}): ${text}`);
    }

    const json = await res.json();
    return schema.parse(json);
  }

  async generateModel(request: ModelRequest): Promise<TripoModel> {
    const response = await this.post("/models/generate", request, modelResponseSchema);
    return response.data;
  }
}

