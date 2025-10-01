import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { locales } from "@/lib/i18n/messages";

function resolveLocale(): string {
  const acceptLanguage = headers().get("accept-language") ?? "";
  if (acceptLanguage.toLowerCase().startsWith("en")) {
    return "en";
  }
  return locales[0] ?? "ja";
}

export default function RootRedirect() {
  const locale = resolveLocale();
  redirect(`/${locale}`);
}
