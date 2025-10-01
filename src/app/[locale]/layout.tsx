import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { ReactNode } from "react";

import { AnalyticsProvider } from "@/components/analytics-provider";
import { LifecycleBoundary } from "@/components/LifecycleBoundary";
import { getMessages, isLocale, locales } from "@/lib/i18n/messages";

type LocaleLayoutProps = {
  children: ReactNode;
  params: {
    locale: string;
  };
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = params;

  if (!isLocale(locale)) {
    notFound();
  }

  const messages = await getMessages(locale);

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <AnalyticsProvider>
        <LifecycleBoundary>{children}</LifecycleBoundary>
      </AnalyticsProvider>
    </NextIntlClientProvider>
  );
}

// Client boundary moved to a client component in src/components/LifecycleBoundary.tsx
