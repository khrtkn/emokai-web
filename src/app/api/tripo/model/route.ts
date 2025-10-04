import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getServerEnv } from "@/lib/env";
import { TripoClient } from "@/lib/tripo/serviceClient";

const imagePayloadSchema = z.object({
  imageBase64: z.string().min(1, "imageBase64 is required"),
  mimeType: z.string().min(1, "mimeType is required"),
  cacheKey: z.string().optional()
});

const requestSchema = z.object({
  characterId: z.string().min(1, "characterId is required"),
  description: z.string().min(1, "description is required"),
  characterImage: imagePayloadSchema,
  targetFormats: z.array(z.literal("GLB").or(z.literal("USDZ"))).min(1).optional()
});

export async function POST(req: NextRequest) {
  try {
    const body = requestSchema.parse(await req.json());
    const env = getServerEnv();
    const client = new TripoClient(env.TRIPO_API_KEY);

    const requestedFormats = body.targetFormats && body.targetFormats.length > 0
      ? body.targetFormats
      : ["GLB"] as const;
    const primaryFormat = requestedFormats[0] === "USDZ" ? "usdz" : "glb";

    const { filePath, cleanup } = await persistImageToTemp(BodyImage.fromPayload(body));

    try {
      const imageToken = await client.uploadImage(filePath);

      const taskId = await client.createImage3DTask(imageToken, {
        modelVersion: "v2.5-20250123",
        faceLimit: 20000,
        pbr: true,
        outFormat: primaryFormat
      });

      const result = await client.pollTask(taskId);
      const urls = collectModelUrls(result);
      const preferredUrl = selectPreferredUrl(result, urls, requestedFormats[0]);

      if (!preferredUrl) {
        return NextResponse.json(
          { error: "Tripo response missing model URL", status: "success", details: result },
          { status: 502 }
        );
      }

      const previewUrl = result.preview ?? result.thumbnail ?? null;

      const alternates = buildAlternates(urls, preferredUrl);

      return NextResponse.json({
        model: {
          id: taskId,
          url: preferredUrl,
          polygons: null,
          previewUrl,
          meta: result,
          alternates: alternates ?? undefined
        }
      });
    } finally {
      await cleanup();
    }
  } catch (error) {
    console.error("Tripo model generation failed", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Failed to generate 3D model" }, { status: 500 });
  }
}

type BodyImage = {
  base64: string;
  mimeType: string;
  fileName: string;
};

namespace BodyImage {
  export function fromPayload(body: z.infer<typeof requestSchema>) {
    const sanitized = body.characterImage.imageBase64.replace(/^data:[^,]+,/, "");
    const extension = inferExtension(body.characterImage.mimeType);
    return {
      base64: sanitized,
      mimeType: body.characterImage.mimeType,
      fileName: `${body.characterId}-${randomUUID()}.${extension}`
    } satisfies BodyImage;
  }
}

async function persistImageToTemp(image: BodyImage) {
  const dir = await fs.mkdtemp(path.join(tmpdir(), "tripo-upload-"));
  const filePath = path.join(dir, image.fileName);
  await fs.writeFile(filePath, Buffer.from(image.base64, "base64"));

  return {
    filePath,
    cleanup: async () => {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        console.warn("Failed to remove temp file", error);
      }
      try {
        await fs.rm(dir, { recursive: true, force: true });
      } catch (error) {
        // ignore
      }
    }
  };
}

function inferExtension(mimeType: string): string {
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

type ModelUrlMap = {
  glb: string | null;
  usdz: string | null;
};

function extractModelUrl(result: Record<string, unknown>): string | null {
  const candidates = [
    (result as { model?: string }).model,
    (result as { pbr_model?: string }).pbr_model,
    (result as { rigged_model?: string }).rigged_model,
    (result as { glb?: string }).glb,
    (result as { usd?: string }).usd,
    (result as { usdz?: string }).usdz,
    (result as { model_url?: string }).model_url
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  if (typeof result === "object" && result && "output" in result) {
    const output = (result as { output?: Record<string, unknown> }).output;
    if (output) {
      return extractModelUrl(output);
    }
  }

  return null;
}

function collectModelUrls(result: Record<string, unknown>): ModelUrlMap {
  return {
    glb: extractFormatUrl(result, "glb"),
    usdz: extractFormatUrl(result, "usdz")
  } satisfies ModelUrlMap;
}

function extractFormatUrl(result: Record<string, unknown>, field: "glb" | "usdz"): string | null {
  const direct = (result as Record<string, unknown>)[field];
  if (typeof direct === "string" && direct.length > 0) {
    return direct;
  }

  const nested = (result as { output?: Record<string, unknown> }).output;
  if (nested && typeof nested === "object") {
    const nestedValue = nested[field];
    if (typeof nestedValue === "string" && nestedValue.length > 0) {
      return nestedValue;
    }
  }

  return null;
}

function selectPreferredUrl(
  result: Record<string, unknown>,
  urls: ModelUrlMap,
  requestedFormat: "GLB" | "USDZ" | undefined
): string | null {
  if (requestedFormat === "USDZ" && urls.usdz) {
    return urls.usdz;
  }
  if (requestedFormat === "GLB" && urls.glb) {
    return urls.glb;
  }
  return urls.glb ?? urls.usdz ?? extractModelUrl(result);
}

function buildAlternates(urls: ModelUrlMap, primaryUrl: string): {
  glb?: string;
  usdz?: string;
} | null {
  const alternates: {
    glb?: string;
    usdz?: string;
  } = {};

  if (urls.glb && urls.glb !== primaryUrl) {
    alternates.glb = urls.glb;
  }
  if (urls.usdz && urls.usdz !== primaryUrl) {
    alternates.usdz = urls.usdz;
  }

  return Object.keys(alternates).length > 0 ? alternates : null;
}
