import { getRequestConfig } from "next-intl/server";
import { locales, isLocale, messages } from "./src/lib/i18n/messages";

export default getRequestConfig(async ({ locale }) => {
  const resolvedLocale = isLocale(locale) ? locale : locales[0];
  return {
    locale: resolvedLocale,
    messages: messages[resolvedLocale]
  };
});
