import Image from 'next/image';
import Link from 'next/link';
import { headers } from 'next/headers';

import { InstructionBanner } from '@/components/ui';

function resolveLocaleFromHeader(): string {
  const acceptLanguage = headers().get('accept-language') ?? '';
  if (acceptLanguage.toLowerCase().startsWith('en')) return 'en';
  return 'ja';
}

function buildLocaleOptions(recommended: string): string[] {
  const options = ["ja", "en"] as const;
  if (recommended === "en") {
    return ["en", "ja"];
  }
  return Array.from(options);
}

function SplashContent({ recommendedLocale }: { recommendedLocale: string }) {
  const locales = buildLocaleOptions(recommendedLocale);
  const primaryLocale = locales[0];
  return (
    <main className="relative overflow-hidden bg-canvas">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(0,216,164,0.35),_transparent_55%),_linear-gradient(160deg,_rgba(13,19,23,0.92)_0%,_rgba(8,12,14,0.98)_65%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-between gap-10 px-6 py-12">
        <div className="flex w-full flex-col items-center">
          <Image
            src="/Logo.png"
            alt="SOFU Emokai"
            width={124}
            height={60}
            className="h-[60px] w-auto"
            priority
          />
        </div>

        <div className="flex w-full flex-col items-stretch gap-3">
          {locales.map((locale, index) => {
            const isPrimary = index === 0;
            const isJapanese = locale === 'ja';
            const label = isJapanese ? '日本語で体験する' : 'Explore in English';
            return (
              <Link
                key={locale}
                href={`/${locale}`}
                className={`flex items-center justify-center rounded-2xl bg-[rgba(12,18,20,0.8)] px-6 py-5 text-center text-sm font-semibold text-textPrimary transition hover:border-accent hover:bg-[rgba(16,24,26,0.85)] ${
                  isPrimary ? 'border border-white/12 shadow-[0_18px_50px_rgba(0,0,0,0.45)]' : 'border border-transparent'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>

        <footer className="flex w-full flex-col items-center gap-4">
          <InstructionBanner tone="default">
            <span className="text-xs">
              {primaryLocale === 'ja'
                ? 'このアプリはカメラとQuick Look対応のiOSデバイス（Safari）を利用します。利用を続けることで利用規約に同意したものとみなされます。'
                : 'This experience uses your camera and requires an iOS device with Quick Look support. Continuing means you agree to the Terms of Use.'}
            </span>
          </InstructionBanner>
          <div className="flex items-center gap-4 text-xs text-textSecondary/70">
            <Link href="/docs/terms" className="transition hover:text-textPrimary">
              {primaryLocale === 'ja' ? '利用規約' : 'Terms'}
            </Link>
            <span className="h-3 w-px bg-divider" aria-hidden="true" />
            <Link href="/docs/privacy" className="transition hover:text-textPrimary">
              {primaryLocale === 'ja' ? 'プライバシー' : 'Privacy'}
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}

export default function SplashPage() {
  const recommendedLocale = resolveLocaleFromHeader();
  return <SplashContent recommendedLocale={recommendedLocale} />;
}
