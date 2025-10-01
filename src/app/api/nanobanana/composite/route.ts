import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getServerEnv } from "@/lib/env";
import { NanobananaClient } from "@/lib/nanobanana/serviceClient";

const requestSchema = z.object({
  stageId: z.string().optional().nullable(),
  characterId: z.string().min(1, "characterId is required")
});

export async function POST(req: NextRequest) {
  try {
    const body = requestSchema.parse(await req.json());
    const env = getServerEnv();
    const client = new NanobananaClient({ apiKey: env.GOOGLE_NANOBANANA_KEY });

    const result = await client.generateComposite({ stageId: body.stageId, characterId: body.characterId });

    return NextResponse.json({ composite: result });
  } catch (error) {
    console.error("Nanobanana composite generation failed", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to generate composite" }, { status: 500 });
  }
}

