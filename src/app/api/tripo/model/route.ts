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
  characterImage: imagePayloadSchema
});

export async function POST(req: NextRequest) {
  try {
    const body = requestSchema.parse(await req.json());
    const env = getServerEnv();
    const client = new TripoClient(env.TRIPO_API_KEY);

    const { filePath, cleanup } = await persistImageToTemp(BodyImage.fromPayload(body));

    try {
      const imageToken = await client.uploadImage(filePath);
      const taskId = await client.createImage3DTask(imageToken, {
        modelVersion: "v2.5-20250123",
        faceLimit: 20000,
        pbr: true,
        texture: "standard",
        quad: false,
        outFormat: "glb"
      });

      const result = await client.pollTask(taskId);
      const modelUrl = result.model ?? result.pbr_model ?? result.glb ?? null;

      if (!modelUrl) {
        return NextResponse.json(
          { error: "Tripo response missing model URL", status: "success", details: result },
          { status: 502 }
        );
      }

      const previewUrl = result.preview ?? result.thumbnail ?? null;

      return NextResponse.json({
        model: {
          id: taskId,
          url: modelUrl,
          polygons: null,
          previewUrl,
          meta: result
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
