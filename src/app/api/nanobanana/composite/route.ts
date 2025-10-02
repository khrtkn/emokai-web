import { randomUUID } from "crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getServerEnv } from "@/lib/env";
import { NanobananaClient } from "@/lib/nanobanana/serviceClient";

const requestSchema = z.object({
  backgroundBase64: z.string().min(1, "backgroundBase64 is required"),
  backgroundMimeType: z.string().min(1).default("image/png"),
  characterBase64: z.string().min(1, "characterBase64 is required"),
  characterMimeType: z.string().min(1).default("image/png"),
  instruction: z.string().optional()
});

export async function POST(req: NextRequest) {
  try {
    const body = requestSchema.parse(await req.json());
    const env = getServerEnv();
    const client = new NanobananaClient({ apiKey: env.GEMINI_API_KEY });

    const image = await client.generateComposite({
      background: {
        mimeType: body.backgroundMimeType,
        data: body.backgroundBase64
      },
      character: {
        mimeType: body.characterMimeType,
        data: body.characterBase64
      },
      instruction: body.instruction
    });

    const composite = {
      id: randomUUID(),
      url: `data:${image.mimeType};base64,${image.data}`,
      imageBase64: image.data,
      mimeType: image.mimeType
    };

    return NextResponse.json({ composite });
  } catch (error) {
    console.error("Nanobanana composite generation failed", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to generate composite" }, { status: 500 });
  }
}
