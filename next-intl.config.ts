import { getRequestConfig } from "next-intl/server";
import { isLocale, locales, messages, type Locale } from "./src/lib/i18n/messages";

export default getRequestConfig(async ({ locale }) => {
  const resolvedLocale: Locale = locale && isLocale(locale) ? locale : locales[0];

  return {
    locale: resolvedLocale,
    messages: messages[resolvedLocale]
  };
});
