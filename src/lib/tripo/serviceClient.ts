import { Buffer } from "node:buffer";

import { z } from "zod";

import { createLogger } from "@/lib/logger";

const defaultBaseUrl = "https://api.tripo3d.ai/v2/openapi";

type TripoTextureSetting = "no" | "standard" | "HD";

export type ImageToModelOptions = {
  texture?: TripoTextureSetting;
  pbr?: boolean;
  faceLimit?: number;
  quad?: boolean;
  modelVersion?: string;
  style?: string;
  negativePrompt?: string;
  textureSeed?: number;
  seed?: number;
  orientation?: "default" | "align_image";
  textureAlignment?: "original_image" | "geometry";
  autoSize?: boolean;
  outFormat?: string;
  fileType?: string;
};

type FetcherConfig = {
  apiKey: string;
  baseUrl?: string;
};

const createTaskResponseSchema = z
  .object({
    task_id: z.string().optional(),
    id: z.string().optional(),
    data: z
      .object({
        task_id: z.string().optional(),
        id: z.string().optional(),
        taskId: z.string().optional(),
        task: z
          .object({
            id: z.string().optional(),
            task_id: z.string().optional()
          })
          .optional()
      })
      .optional(),
    result: z
      .object({
        task_id: z.string().optional(),
        id: z.string().optional()
      })
      .optional()
  })
  .passthrough();

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
  private readonly logger = createLogger("tripo");

  constructor({ apiKey, baseUrl = defaultBaseUrl }: FetcherConfig) {
    if (!apiKey) {
      throw new Error("TRIPO_API_KEY is required");
    }
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async uploadImageFromBase64(base64: string, mimeType: string, fileName?: string) {
    const sanitized = stripDataUrlPrefix(base64);
    const buffer = Buffer.from(sanitized, "base64");
    const extension = inferExtensionFromMime(mimeType);
    const uploadName = fileName ?? `character.${extension}`;

    const form = new FormData();
    form.append("file", new Blob([buffer], { type: mimeType }), uploadName);

    this.logger.info("upload:start", { mimeType, uploadName });

    const res = await fetch(`${this.baseUrl}/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`
      },
      body: form
    });

    const json = await res.json().catch(() => null);

    this.logger.info("upload:response", {
      status: res.status,
      ok: res.ok,
      raw: json
    });

    if (!res.ok) {
      const message =
        (json as { error?: { message?: string }; message?: string } | null)?.error?.message ??
        (json as { message?: string } | null)?.message ??
        res.statusText;
      throw new Error(`Tripo upload error (${res.status}): ${message}`);
    }

    const token =
      (json as { data?: { image_token?: string; file_token?: string } } | null)?.data?.image_token ??
      (json as { data?: { image_token?: string; file_token?: string } } | null)?.data?.file_token;

    if (!token) {
      throw new Error("Tripo upload response missing image token");
    }

    return { token, fileType: extension };
  }

  async createImageToModelTask(
    imageToken: string,
    options: ImageToModelOptions = {}
  ): Promise<string> {
    const payload: Record<string, unknown> = {
      type: "image_to_model",
      file: {
        type: options.fileType ?? "png",
        file_token: imageToken
      },
      model_version: options.modelVersion ?? "v2.5-20250123",
      face_limit: options.faceLimit ?? 20000,
      pbr: options.pbr ?? true,
      out_format: options.outFormat ?? "glb"
    };

    if (options.texture !== undefined) {
      payload.texture = options.texture;
    } else {
      payload.texture = "standard";
    }
    if (options.quad !== undefined) {
      payload.quad = options.quad;
    } else {
      payload.quad = false;
    }
    if (options.style) {
      payload.style = options.style;
    }
    if (options.negativePrompt) {
      payload.negative_prompt = options.negativePrompt;
    }
    if (typeof options.textureSeed === "number") {
      payload.texture_seed = options.textureSeed;
    }
    if (typeof options.seed === "number") {
      payload.seed = options.seed;
    }
    if (options.orientation) {
      payload.orientation = options.orientation;
    }
    if (options.textureAlignment) {
      payload.texture_alignment = options.textureAlignment;
    }
    if (typeof options.autoSize === "boolean") {
      payload.auto_size = options.autoSize;
    }

    return this.postTask(payload);
  }

  async createTextToModelTask(prompt: string, options: Partial<ImageToModelOptions> = {}) {
    const payload: Record<string, unknown> = {
      type: "text_to_model",
      prompt,
      model_version: options.modelVersion ?? "v2.5-20250123"
    };

    if (options.texture !== undefined) {
      payload.texture = options.texture;
    } else {
      payload.texture = "standard";
    }
    if (options.pbr !== undefined) {
      payload.pbr = options.pbr;
    }
    if (typeof options.faceLimit === "number") {
      payload.face_limit = options.faceLimit;
    }
    if (options.quad !== undefined) {
      payload.quad = options.quad;
    }
    if (options.negativePrompt) {
      payload.negative_prompt = options.negativePrompt;
    }
    if (typeof options.seed === "number") {
      payload.seed = options.seed;
    }

    return this.postTask(payload);
  }

  async getTask(taskId: string): Promise<TripoTaskStatus> {
    this.logger.info("getTask:start", { taskId });

    const res = await fetch(`${this.baseUrl}/task/${taskId}`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`
      }
    });

    const json = await res.json().catch(() => null);

    this.logger.info("getTask:response", {
      taskId,
      status: res.status,
      ok: res.ok,
    });

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

    this.logger.info("getTask:parsed", {
      taskId,
      status,
      progress,
      hasModelUrl: Boolean(modelUrl),
      hasPreview: Boolean(previewUrl),
    });

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

  private async postTask(payload: Record<string, unknown>): Promise<string> {
    this.logger.info("task:post:start", {
      type: payload.type,
      hasImageUrl: Boolean((payload as { image_url?: string }).image_url),
      hasPrompt: Boolean((payload as { prompt?: string }).prompt),
      keys: Object.keys(payload),
      payload: JSON.stringify(payload)
    });

    const res = await fetch(`${this.baseUrl}/task`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(payload)
    });

    const json = await res.json().catch(() => null);

    this.logger.info("task:post:response", {
      status: res.status,
      ok: res.ok,
      raw: json
    });

    if (!res.ok) {
      const message =
        (json as { error?: { message?: string }; message?: string } | null)?.error?.message ??
        (json as { message?: string } | null)?.message ??
        res.statusText;
      throw new Error(`Tripo API error (${res.status}): ${message}`);
    }

    const parsed: ParsedCreateTaskResponse = createTaskResponseSchema.parse(json);
    const taskId =
      parsed.task_id ??
      parsed.id ??
      parsed.data?.task_id ??
      parsed.data?.id ??
      parsed.data?.taskId ??
      parsed.data?.task?.task_id ??
      parsed.data?.task?.id ??
      parsed.result?.task_id ??
      parsed.result?.id ??
      null;

    if (!taskId) {
      this.logger.error("task:post:missingTaskId", json);
      throw new Error(
        `Tripo create task response missing task_id (payload: ${JSON.stringify(json)})`
      );
    }

    this.logger.info("task:post:success", { taskId });
    return taskId;
  }
}

function getStatus(json: unknown): string {
  const candidate = (json as Record<string, unknown>) ?? {};
  const data = (candidate.data as Record<string, unknown>) ?? {};
  const output = (candidate.output as Record<string, unknown>) ?? {};
  const raw =
    (candidate.status as string | undefined) ||
    (data.status as string | undefined) ||
    (output.status as string | undefined) ||
    "UNKNOWN";
  return raw.toUpperCase();
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
  const result = (candidate.result as Record<string, unknown>) ?? {};
  const nestedResult = (data.result as Record<string, unknown>) ?? {};

  const modelUrl =
    ((candidate.model_url as string | undefined) ||
      (output.model_url as string | undefined) ||
      (nestedOutput.model_url as string | undefined) ||
      findUrlByExtensions([candidate, data, output, nestedOutput, result, nestedResult], [
        ".glb",
        ".fbx",
        ".usdz",
        ".obj",
        ".zip",
      ])) ?? null;

  const previewUrl =
    ((candidate.preview as string | undefined) ||
      (output.preview as string | undefined) ||
      (nestedOutput.preview as string | undefined) ||
      findUrlByExtensions([candidate, data, output, nestedOutput, result, nestedResult], [
        ".png",
        ".jpg",
        ".jpeg",
        ".webp",
        ".gif",
      ])) ?? null;

  return {
    modelUrl: modelUrl ?? null,
    previewUrl: previewUrl ?? null
  };
}

function findUrlByExtensions(
  sources: unknown[],
  extensions: string[],
): string | null {
  const visited = new WeakSet<object>();

  const lowerExt = extensions.map((ext) => ext.toLowerCase());

  const search = (value: unknown): string | null => {
    if (!value || typeof value !== "object") return null;
    if (visited.has(value as object)) return null;
    visited.add(value as object);

    for (const val of Object.values(value as Record<string, unknown>)) {
      if (typeof val === "string") {
        const lower = val.toLowerCase();
        if (lower.startsWith("http")) {
          if (lowerExt.some((ext) => lower.includes(ext))) {
            return val;
          }
        }
      } else if (typeof val === "object" && val !== null) {
        const found = search(val);
        if (found) return found;
      }
    }
    return null;
  };

  for (const source of sources) {
    const result = search(source);
    if (result) return result;
  }

  return null;
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

function inferExtensionFromMime(mimeType: string): string {
  switch (mimeType.toLowerCase()) {
    case "image/png":
      return "png";
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/webp":
      return "webp";
    default:
      return "png";
  }
}

function stripDataUrlPrefix(base64: string): string {
  const commaIndex = base64.indexOf(",");
  if (commaIndex !== -1) {
    return base64.slice(commaIndex + 1);
  }
  return base64;
}
