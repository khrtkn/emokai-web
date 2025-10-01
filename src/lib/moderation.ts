import type { Locale } from "@/lib/i18n/messages";

const NG_WORDS = [
  "kill",
  "murder",
  "爆弾",
  "テロ"
];

export type ModerationResult = {
  allowed: boolean;
  reason?: string;
};

export async function moderateText(input: string, locale: Locale): Promise<ModerationResult> {
  const trimmed = input.trim();

  if (!trimmed) {
    return {
      allowed: false,
      reason: locale === "ja" ? "テキストを入力してください" : "Please enter a description."
    };
  }

  const lower = trimmed.toLowerCase();
  const found = NG_WORDS.find((word) => lower.includes(word));

  if (found) {
    return {
      allowed: false,
      reason:
        locale === "ja"
          ? "不適切な内容が含まれています"
          : "Inappropriate content detected."
    };
  }

  // TODO: Integrate OpenAI Moderation API.
  await new Promise((resolve) => setTimeout(resolve, 400));

  return { allowed: true };
}
