import { Buffer } from "node:buffer";

import { z } from "zod";

import { createLogger } from "@/lib/logger";

const defaultBaseUrl = "https://api.tripo3d.ai/v2/openapi";

const uploadResponseSchema = z
  .object({
    code: z.number().optional(),
    data: z
      .object({
        upload_id: z.string().optional(),
        upload_url: z.string().url().optional(),
        fields: z.record(z.string()).optional(),
        image_token: z.string().optional()
      })
      .optional(),
    message: z.string().optional()
  })
  .passthrough();

type UploadResponse = z.infer<typeof uploadResponseSchema>;

type S3UploadTicket = {
  uploadId: string;
  uploadUrl: string;
  fields: Record<string, string>;
};

type UploadReference =
  | { mode: "image_token"; value: string }
  | { mode: "upload_id"; value: string };

export type CreateTaskRequest = {
  prompt: string;
  type?: "text_to_model" | "image_to_model" | "multiview_to_model";
  imageUrl?: string;
  uploadReference?: UploadReference;
  texture?: boolean;
  pbr?: boolean;
  textureQuality?: "standard" | "detailed";
  faceLimit?: number;
  quad?: boolean;
  modelVersion?: string;
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
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async createTask(request: CreateTaskRequest): Promise<string> {
    const inferredType = request.uploadReference
      ? "image_to_model"
      : request.imageUrl
      ? "image_to_model"
      : "text_to_model";

    const texture = request.texture ?? true;
    const pbr = request.pbr ?? true;
    const textureQuality = request.textureQuality ?? "standard";
    const faceLimit = request.faceLimit ?? 20000;
    const quad = request.quad ?? false;

    const payload: Record<string, unknown> = {
      type: request.type ?? inferredType,
      prompt: request.prompt,
    };

    if (request.imageUrl) {
      payload.image_url = request.imageUrl;
    }

    if (request.uploadReference) {
      if (request.uploadReference.mode === "image_token") {
        payload.image_token = request.uploadReference.value;
        payload.image_tokens = [request.uploadReference.value];
      } else {
        payload.file = {
          type: "upload_id",
          value: request.uploadReference.value
        };
      }
    }

    if (texture !== undefined) {
      payload.texture = texture;
    }
    if (pbr !== undefined) {
      payload.pbr = pbr;
    }
    if (textureQuality) {
      payload.texture_quality = textureQuality;
    }
    if (faceLimit) {
      payload.face_limit = faceLimit;
    }
    if (quad !== undefined) {
      payload.quad = quad;
    }

    if (request.modelVersion) {
      payload.model_version = request.modelVersion;
    }

    this.logger.info("createTask:start", {
      type: payload.type,
      hasImageUrl: Boolean(payload.image_url),
      hasUploadRef: Boolean(request.uploadReference),
      uploadMode: request.uploadReference?.mode ?? null,
      faceLimit,
      textureQuality,
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

    this.logger.info("createTask:response", {
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
      this.logger.error("createTask:missingTaskId", json);
      throw new Error(
        `Tripo create task response missing task_id (payload: ${JSON.stringify(json)})`
      );
    }

    this.logger.info("createTask:success", { taskId });

    return taskId;
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

  async uploadImageFromBase64(options: {
    base64: string;
    mimeType: string;
    fileName?: string;
    type?: "image";
  }): Promise<UploadReference> {
    const normalizedBase64 = stripDataUrlPrefix(options.base64);
    const fileName = options.fileName ?? `character.${inferExtensionFromMime(options.mimeType)}`;
    const blob = new Blob([Buffer.from(normalizedBase64, "base64")], { type: options.mimeType });

    const candidateBases = [this.baseUrl];
    if (this.baseUrl.endsWith("/openapi")) {
      candidateBases.push(this.baseUrl.replace(/\/openapi$/, ""));
    }

    const endpoints = candidateBases
      .flatMap((base) => [
        `${base}/upload/sts`,
        `${base}/upload/sts/token`
      ])
      .filter((value, index, self) => self.indexOf(value) === index);

    let lastError: Error | null = null;

    for (const endpoint of endpoints) {
      try {
        this.logger.info("upload:image:start", { endpoint });

        const form = new FormData();
        form.append("file", blob, fileName);

        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`
          },
          body: form
        });

        const json = await res.json().catch(() => null);

        this.logger.info("upload:image:response", {
          endpoint,
          status: res.status,
          ok: res.ok
        });

        if (!res.ok) {
          const message =
            (json as { error?: { message?: string }; message?: string } | null)?.error?.message ??
            (json as { message?: string } | null)?.message ??
            res.statusText;

          if (res.status === 404 && endpoint !== endpoints[endpoints.length - 1]) {
            this.logger.warn("upload:image:notFoundRetry", { endpoint });
            lastError = new Error(`Tripo upload error (${res.status}): ${message}`);
            continue;
          }

          throw new Error(`Tripo upload error (${res.status}): ${message}`);
        }

        const parsed: UploadResponse = uploadResponseSchema.parse(json ?? {});
        const code = parsed.code ?? 0;
        const data = parsed.data;

        if (code !== 0) {
          const message = parsed.message ?? `Non-zero code ${code}`;
          lastError = new Error(`Tripo upload error (code ${code}): ${message}`);
          continue;
        }

        if (!data) {
          lastError = new Error("Tripo upload response missing data payload");
          continue;
        }

        if (data.image_token) {
          return { mode: "image_token", value: data.image_token };
        }

        if (data.upload_id && data.upload_url && data.fields) {
          const ticket: S3UploadTicket = {
            uploadId: data.upload_id,
            uploadUrl: data.upload_url,
            fields: data.fields
          };
          await this.uploadToS3(ticket, normalizedBase64, options.mimeType, fileName);
          return { mode: "upload_id", value: ticket.uploadId };
        }

        this.logger.warn("upload:image:unsupportedResponse", { endpoint, json });
        lastError = new Error("Tripo upload response missing image token or upload ticket");
      } catch (error) {
        lastError = error as Error;
        this.logger.error("upload:image:error", { endpoint, error: (error as Error).message });
      }
    }

    if (lastError) {
      throw lastError;
    }

    throw new Error("Tripo upload failed for all endpoints");
  }

  private async uploadToS3(
    ticket: S3UploadTicket,
    base64: string,
    mimeType: string,
    fileName: string
  ) {
    const buffer = Buffer.from(base64, "base64");
    const blob = new Blob([buffer], { type: mimeType });
    const form = new FormData();

    for (const [key, value] of Object.entries(ticket.fields)) {
      form.append(key, value);
    }

    form.append("Content-Type", mimeType);
    form.append("file", blob, fileName);

    this.logger.info("upload:toS3:start", {
      uploadId: ticket.uploadId,
      uploadUrl: ticket.uploadUrl
    });

    const res = await fetch(ticket.uploadUrl, {
      method: "POST",
      body: form
    });

    this.logger.info("upload:toS3:response", {
      uploadId: ticket.uploadId,
      status: res.status,
      ok: res.ok
    });

    if (!res.ok) {
      const text = await res.text().catch(() => null);
      throw new Error(
        `Tripo S3 upload failed (${res.status}): ${text ?? "Unknown error"}`
      );
    }
  }
}

function inferExtensionFromMime(mimeType: string): string {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/webp":
      return "webp";
    default:
      return "img";
  }
}

function stripDataUrlPrefix(base64: string): string {
  const commaIndex = base64.indexOf(",");
  if (commaIndex !== -1) {
    return base64.slice(commaIndex + 1);
  }
  return base64;
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
        '.glb',
        '.fbx',
        '.usdz',
        '.obj',
        '.zip',
      ])) ?? null;

  const previewUrl =
    ((candidate.preview as string | undefined) ||
      (output.preview as string | undefined) ||
      (nestedOutput.preview as string | undefined) ||
      findUrlByExtensions([candidate, data, output, nestedOutput, result, nestedResult], [
        '.png',
        '.jpg',
        '.jpeg',
        '.webp',
        '.gif',
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
    if (!value || typeof value !== 'object') return null;
    if (visited.has(value as object)) return null;
    visited.add(value as object);

    for (const val of Object.values(value as Record<string, unknown>)) {
      if (typeof val === 'string') {
        const lower = val.toLowerCase();
        if (lower.startsWith('http')) {
          if (lowerExt.some((ext) => lower.includes(ext))) {
            return val;
          }
        }
      } else if (typeof val === 'object' && val !== null) {
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
