"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import type { Locale } from "@/lib/i18n/messages";

const deviceTypeLabel: Record<string, string> = {
  ios: "iOS",
  android: "Android"
};

function detectDevice(): "ios" | "android" | "unknown" {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "unknown";
}

type TermsGateProps = {
  locale: Locale;
};

export default function TermsGate({ locale }: TermsGateProps) {
  const t = useTranslations("terms");
  const router = useRouter();
  const [, startTransition] = useTransition();
  const device = detectDevice();

  const handleAccept = () => {
    startTransition(() => {
      router.push(`/${locale}/start?accepted=true`);
    });
  };

  const toggleLocale = locale === "ja" ? "en" : "ja";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-8 px-6 py-12">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{t("heading")}</h1>
        <Link
          href={`/${toggleLocale}/start`}
          hrefLang={toggleLocale}
          className="rounded-full border border-divider px-3 py-1 text-xs uppercase tracking-wide text-textSecondary"
        >
          {toggleLocale === "ja" ? "日本語" : "English"}
        </Link>
      </header>
      <section className="space-y-4 rounded-2xl border border-divider bg-[rgba(255,255,255,0.05)] p-6 text-sm">
        <p>{t("device", { device: deviceTypeLabel[device] ?? "" })}</p>
        <p>{t("permissions")}</p>
        <ul className="list-disc space-y-2 pl-5 text-textSecondary">
          <li>{t("permissionCamera")}</li>
          <li>{t("permissionPhotos")}</li>
        </ul>
      </section>
      <section className="space-y-3 rounded-2xl border border-divider bg-[rgba(255,255,255,0.05)] p-6 text-sm">
        <h2 className="text-base font-semibold">{t("termsHeading")}</h2>
        <p className="text-textSecondary">{t("termsBody")}</p>
        <p className="text-xs text-textSecondary">{t("license")}</p>
        <button
          type="button"
          onClick={handleAccept}
          className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90"
        >
          {t("accept")}
        </button>
      </section>
      <footer className="text-center text-xs text-textSecondary">
        {t("sessionId")}
      </footer>
    </main>
  );
}
