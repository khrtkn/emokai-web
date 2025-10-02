import { randomUUID } from "crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getServerEnv } from "@/lib/env";
import { NanobananaClient } from "@/lib/nanobanana/serviceClient";
import type { StageOption } from "@/lib/stage-generation";

const requestSchema = z.object({
  description: z.string().min(1, "description is required"),
  referenceImageBase64: z.string().min(1).optional(),
  referenceImageMimeType: z.string().min(1).optional()
});

export async function POST(req: NextRequest) {
  try {
    const body = requestSchema.parse(await req.json());
    const env = getServerEnv();
    const client = new NanobananaClient({ apiKey: env.GEMINI_API_KEY });

    const images = await client.generateStage({
      prompt: body.description,
      referenceImage: body.referenceImageBase64
        ? {
            mimeType: body.referenceImageMimeType ?? "image/webp",
            data: body.referenceImageBase64
          }
        : undefined
    });

    const options: StageOption[] = images.slice(0, 4).map((image) => ({
      id: randomUUID(),
      previewUrl: `data:${image.mimeType};base64,${image.data}`,
      imageBase64: image.data,
      mimeType: image.mimeType,
      prompt: body.description
    }));

    return NextResponse.json({ options });
  } catch (error) {
    console.error("Nanobanana stage generation failed", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to generate stage options" }, { status: 500 });
  }
}
