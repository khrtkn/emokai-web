import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getServerEnv } from "@/lib/env";
import { TripoClient, type TripoTaskStatus } from "@/lib/tripo/serviceClient";

const imagePayloadSchema = z.object({
  imageBase64: z.string().min(1, "imageBase64 is required"),
  mimeType: z.string().min(1, "mimeType is required"),
  cacheKey: z.string().optional()
});

const requestSchema = z.object({
  characterId: z.string().min(1, "characterId is required"),
  description: z.string().min(1, "description is required"),
  characterImage: imagePayloadSchema
});

const MAX_ATTEMPTS = 30;
const POLL_INTERVAL_MS = 4000;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(req: NextRequest) {
  try {
    const body = requestSchema.parse(await req.json());
    const env = getServerEnv();
    const client = new TripoClient({ apiKey: env.TRIPO_API_KEY });

    const fileName = `${body.characterId}.${inferExtension(body.characterImage.mimeType)}`;
    const uploadId = await client.uploadImageFromBase64({
      base64: body.characterImage.imageBase64,
      mimeType: body.characterImage.mimeType,
      fileName
    });

    const taskId = await client.createTask({
      prompt: body.description,
      type: "image_to_model",
      fileUploadId: uploadId,
      modelVersion: "default"
    });

    const status = await pollForCompletion(client, taskId);

    if (status.status.toUpperCase() !== "SUCCESS") {
      console.error("Tripo task did not complete successfully", status);
      return NextResponse.json(
        {
          error: "Tripo task did not complete successfully",
          status: status.status,
          details: status.error ?? status.meta
        },
        { status: 502 }
      );
    }

    if (!status.modelUrl) {
      return NextResponse.json(
        { error: "Tripo response missing model URL", status: status.status },
        { status: 502 }
      );
    }

    const polygons = extractPolygonCount(status.meta);

    return NextResponse.json({
      model: {
        id: taskId,
        url: status.modelUrl,
        polygons,
        previewUrl: status.previewUrl,
        meta: status.meta
      }
    });
  } catch (error) {
    console.error("Tripo model generation failed", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to generate 3D model" }, { status: 500 });
  }
}

function inferExtension(mimeType: string): string {
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

async function pollForCompletion(client: TripoClient, taskId: string): Promise<TripoTaskStatus> {
  let attempt = 0;
  let status: TripoTaskStatus = await client.getTask(taskId);

  while (attempt < MAX_ATTEMPTS) {
    if (status.status === "SUCCESS" || status.status === "FAILED" || status.status === "ERROR") {
      return status;
    }
    attempt += 1;
    await delay(POLL_INTERVAL_MS);
    status = await client.getTask(taskId);
  }

  return status;
}

function extractPolygonCount(meta: Record<string, unknown> | null): number | null {
  if (!meta) return null;
  for (const key of ["polygons", "faces", "face_count", "triangles"]) {
    const value = meta[key];
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}
