import { z } from "zod";

const defaultBaseUrl = "https://api.tripo3d.ai/v2/openapi";

export type CreateTaskRequest = {
  prompt: string;
  type?: "text_to_model" | "image_to_model" | "multiview_to_model";
  imageUrl?: string;
  texture?: boolean;
  pbr?: boolean;
  textureQuality?: "standard" | "detailed";
  faceLimit?: number;
  quad?: boolean;
};

type FetcherConfig = {
  apiKey: string;
  baseUrl?: string;
};

const createTaskResponseSchema = z.object({
  task_id: z.string().optional(),
  id: z.string().optional()
});

type ParsedCreateTaskResponse = z.infer<typeof createTaskResponseSchema>;

export type TripoTaskStatus = {
  taskId: string;
  status: string;
  progress: number | null;
  modelUrl: string | null;
  previewUrl: string | null;
  meta: Record<string, unknown> | null;
  error?: unknown;
};

export class TripoClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor({ apiKey, baseUrl = defaultBaseUrl }: FetcherConfig) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async createTask(request: CreateTaskRequest): Promise<string> {
    const payload = {
      type: request.type ?? (request.imageUrl ? "image_to_model" : "text_to_model"),
      prompt: request.prompt,
      image_url: request.imageUrl,
      texture: request.texture ?? true,
      pbr: request.pbr ?? true,
      texture_quality: request.textureQuality ?? "standard",
      face_limit: request.faceLimit ?? 20000,
      quad: request.quad ?? false
    };

    const res = await fetch(`${this.baseUrl}/task`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(payload)
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      const message =
        (json as { error?: { message?: string } } | null)?.error?.message ?? res.statusText;
      throw new Error(`Tripo API error (${res.status}): ${message}`);
    }

    const parsed: ParsedCreateTaskResponse = createTaskResponseSchema.parse(json);
    const taskId = parsed.task_id ?? parsed.id;

    if (!taskId) {
      throw new Error("Tripo create task response missing task_id");
    }

    return taskId;
  }

  async getTask(taskId: string): Promise<TripoTaskStatus> {
    const res = await fetch(`${this.baseUrl}/task/${taskId}`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`
      }
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      const message =
        (json as { error?: { message?: string } } | null)?.error?.message ?? res.statusText;
      throw new Error(`Tripo API error (${res.status}): ${message}`);
    }

    const status = getStatus(json);
    const progress = getProgress(json);
    const { modelUrl, previewUrl } = getOutputUrls(json);
    const meta = getMeta(json);
    const error = getError(json);

    return {
      taskId,
      status,
      progress,
      modelUrl,
      previewUrl,
      meta,
      error
    };
  }
}

function getStatus(json: unknown): string {
  const candidate = (json as Record<string, unknown>) ?? {};
  const data = (candidate.data as Record<string, unknown>) ?? {};
  const output = (candidate.output as Record<string, unknown>) ?? {};
  return (
    (candidate.status as string | undefined) ||
    (data.status as string | undefined) ||
    (output.status as string | undefined) ||
    "UNKNOWN"
  );
}

function getProgress(json: unknown): number | null {
  const candidate = (json as Record<string, unknown>) ?? {};
  const data = (candidate.data as Record<string, unknown>) ?? {};
  const progress =
    (candidate.progress as number | undefined) ??
    (data.progress as number | undefined) ??
    null;
  return typeof progress === "number" ? progress : null;
}

function getOutputUrls(json: unknown): { modelUrl: string | null; previewUrl: string | null } {
  const candidate = (json as Record<string, unknown>) ?? {};
  const data = (candidate.data as Record<string, unknown>) ?? {};
  const output = (candidate.output as Record<string, unknown>) ?? {};
  const nestedOutput = (data.output as Record<string, unknown>) ?? {};

  const modelUrl =
    (candidate.model_url as string | undefined) ||
    (output.model_url as string | undefined) ||
    (nestedOutput.model_url as string | undefined) ||
    null;

  const previewUrl =
    (candidate.preview as string | undefined) ||
    (output.preview as string | undefined) ||
    (nestedOutput.preview as string | undefined) ||
    null;

  return {
    modelUrl: modelUrl ?? null,
    previewUrl: previewUrl ?? null
  };
}

function getMeta(json: unknown): Record<string, unknown> | null {
  const candidate = (json as Record<string, unknown>) ?? {};
  const data = (candidate.data as Record<string, unknown>) ?? {};
  const nestedOutput = (data.output as Record<string, unknown>) ?? {};
  const meta =
    (candidate.meta as Record<string, unknown> | undefined) ||
    (data.meta as Record<string, unknown> | undefined) ||
    (nestedOutput.meta as Record<string, unknown> | undefined) ||
    null;
  return meta ?? null;
}

function getError(json: unknown): unknown {
  const candidate = (json as Record<string, unknown>) ?? {};
  return candidate.error ?? (candidate.data as Record<string, unknown>)?.error ?? undefined;
}
