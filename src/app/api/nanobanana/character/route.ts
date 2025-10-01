import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getServerEnv } from "@/lib/env";
import { NanobananaClient } from "@/lib/nanobanana/serviceClient";
import type { CharacterOption } from "@/lib/character-generation";

const requestSchema = z.object({
  description: z.string().min(1, "description is required")
});

export async function POST(req: NextRequest) {
  try {
    const body = requestSchema.parse(await req.json());
    const env = getServerEnv();
    const client = new NanobananaClient({ apiKey: env.GOOGLE_NANOBANANA_KEY });

    const images = await client.generateCharacter({ prompt: body.description });

    const options: CharacterOption[] = images.map((image) => ({
      id: image.id,
      previewUrl: image.url,
      prompt: body.description
    }));

    return NextResponse.json({ options });
  } catch (error) {
    console.error("Nanobanana character generation failed", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to generate character options" }, { status: 500 });
  }
}

