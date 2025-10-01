import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getServerEnv } from "@/lib/env";
import { OpenAIClient } from "@/lib/openai/serviceClient";
import type { Locale } from "@/lib/i18n/messages";

const requestSchema = z.object({
  description: z.string().min(1, "description is required"),
  locale: z.string().min(1).default("ja")
});

export async function POST(req: NextRequest) {
  try {
    const body = requestSchema.parse(await req.json());
    const env = getServerEnv();
    const client = new OpenAIClient({ apiKey: env.OPENAI_API_KEY });

    const story = await client.generateStory({
      prompt: body.description,
      locale: body.locale
    });

    return NextResponse.json({
      story: {
        id: story.id,
        locale: body.locale as Locale,
        content: story.content
      }
    });
  } catch (error) {
    console.error("OpenAI story generation failed", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to generate story" }, { status: 500 });
  }
}

