import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getServerEnv } from "@/lib/env";
import { TripoClient } from "@/lib/tripo/serviceClient";

const requestSchema = z.object({
  characterId: z.string().min(1, "characterId is required")
});

export async function POST(req: NextRequest) {
  try {
    const body = requestSchema.parse(await req.json());
    const env = getServerEnv();
    const client = new TripoClient({ apiKey: env.TRIPO_API_KEY });

    const model = await client.generateModel({ characterId: body.characterId });

    return NextResponse.json({ model });
  } catch (error) {
    console.error("Tripo model generation failed", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to generate 3D model" }, { status: 500 });
  }
}

