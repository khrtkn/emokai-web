import { randomUUID } from "crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getServerEnv } from "@/lib/env";
import { NanobananaClient } from "@/lib/nanobanana/serviceClient";

const jsonRequestSchema = z.object({
  backgroundBase64: z.string().min(1, "backgroundBase64 is required"),
  backgroundMimeType: z.string().min(1).default("image/png"),
  characterBase64: z.string().min(1, "characterBase64 is required"),
  characterMimeType: z.string().min(1).default("image/png"),
  instruction: z.string().optional()
});

export async function POST(req: NextRequest) {
  try {
    const env = getServerEnv();
    const client = new NanobananaClient({ apiKey: env.GEMINI_API_KEY });

    const contentType = req.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json")
      ? await parseJsonPayload(req)
      : await parseFormPayload(req);

    const image = await client.generateComposite({
      background: payload.background,
      character: payload.character,
      instruction: payload.instruction
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

async function parseJsonPayload(req: NextRequest) {
  const body = jsonRequestSchema.parse(await req.json());
  return {
    background: {
      mimeType: body.backgroundMimeType,
      data: body.backgroundBase64
    },
    character: {
      mimeType: body.characterMimeType,
      data: body.characterBase64
    },
    instruction: body.instruction
  };
}

async function parseFormPayload(req: NextRequest) {
  const form = await req.formData();
  const background = await readImagePart(form, "background", "backgroundMimeType");
  const character = await readImagePart(form, "character", "characterMimeType");
  const instruction = form.get("instruction");
  return {
    background,
    character,
    instruction: typeof instruction === "string" ? instruction : undefined
  };
}

async function readImagePart(form: FormData, dataKey: string, mimeKey: string) {
  const entry = form.get(dataKey);
  if (!(entry instanceof Blob)) {
    const base64 = typeof entry === "string" ? entry : null;
    const mimeType = typeof form.get(mimeKey) === "string" ? (form.get(mimeKey) as string) : "image/png";
    if (!base64) {
      throw new Error(`${dataKey} payload missing`);
    }
    return {
      mimeType,
      data: base64
    };
  }

  const arrayBuffer = await entry.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const mimeType = entry.type || (typeof form.get(mimeKey) === "string" ? (form.get(mimeKey) as string) : "image/png");
  return {
    mimeType,
    data: base64
  };
}
