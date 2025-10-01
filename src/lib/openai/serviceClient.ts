import { z } from "zod";

const defaultBaseUrl = "https://api.openai.com/v1";
const defaultModel = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

type FetcherConfig = {
  apiKey: string;
  baseUrl?: string;
  model?: string;
};

type StoryRequest = {
  prompt: string;
  locale: string;
};

const completionSchema = z.object({
  id: z.string(),
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string() })
      })
    )
    .min(1)
});

export type OpenAIStory = {
  id: string;
  content: string;
};

export class OpenAIClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor({ apiKey, baseUrl = defaultBaseUrl, model = defaultModel }: FetcherConfig) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.model = model;
  }

  async generateStory({ prompt, locale }: StoryRequest): Promise<OpenAIStory> {
    const messages = this.buildMessages(prompt, locale);

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.7
      })
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenAI API error (${res.status}): ${text}`);
    }

    const json = await res.json();
    const parsed = completionSchema.parse(json);
    const content = parsed.choices[0]?.message?.content ?? "";

    if (!content) {
      throw new Error("OpenAI response missing content");
    }

    return {
      id: parsed.id,
      content
    };
  }

  private buildMessages(prompt: string, locale: string) {
    const system =
      locale === "ja"
        ? "あなたは感情の妖怪『エモカイ』の物語を紡ぐ語り部です。ユーザーが入力した場所や感情をもとに、優しくも不思議な短い物語を日本語で作成してください。"
        : "You are a storyteller weaving the tale of an 'Emokai', a yokai born from emotions. Use the user's inputs to craft a short, gentle, and mysterious story in English.";

    return [
      { role: "system", content: system },
      { role: "user", content: prompt }
    ];
  }
}

