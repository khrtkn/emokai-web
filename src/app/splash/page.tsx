import Image from 'next/image';
import Link from 'next/link';
import { headers } from 'next/headers';

import { InstructionBanner } from '@/components/ui';

const SUPPORTED_LOCALES = ['ja', 'en'] as const;

function resolveLocaleFromHeader(): string {
  const acceptLanguage = headers().get('accept-language') ?? '';
  if (acceptLanguage.toLowerCase().startsWith('en')) return 'en';
  return 'ja';
}

function SplashContent({ recommendedLocale }: { recommendedLocale: string }) {
  return (
    <main className="relative overflow-hidden bg-canvas">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(0,216,164,0.35),_transparent_55%),_linear-gradient(160deg,_rgba(13,19,23,0.92)_0%,_rgba(8,12,14,0.98)_65%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col items-center gap-8 px-6 py-12">
        <div className="flex w-full flex-col items-center gap-4 text-center">
          <Image src="/Logo.png" alt="SOFU Emokai" width={124} height={60} className="h-[60px] w-auto" priority />
          <p className="text-sm text-textSecondary">
            {recommendedLocale === 'ja'
              ? '感情から生まれるエモカイを見つけ、ARで呼び出そう。'
              : 'Discover the Emokai born from your feelings and bring them into AR.'}
          </p>
        </div>

        <div className="flex w-full flex-col gap-3">
          {SUPPORTED_LOCALES.map((locale) => {
            const isJapanese = locale === 'ja';
            const label = isJapanese ? '日本語で体験する' : 'Explore in English';
            const description = isJapanese
              ? 'Emokai の旅を日本語で進める'
              : 'Experience Emokai in English';
            const isRecommended = locale === recommendedLocale;
            return (
              <Link
                key={locale}
                href={`/${locale}`}
                aria-current={isRecommended ? 'true' : undefined}
                className={`rounded-2xl border px-5 py-4 text-left transition hover:border-accent/80 hover:bg-[rgba(18,24,27,0.85)] ${
                  isRecommended
                    ? 'border-white/70 bg-[rgba(255,255,255,0.04)] shadow-[0_18px_50px_rgba(0,0,0,0.45)]'
                    : 'border-white/20 bg-[rgba(12,18,20,0.65)]'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-base font-semibold text-textPrimary">{label}</span>
                  {isRecommended ? (
                    <span className="text-[10px] uppercase tracking-[0.25em] text-textSecondary/70">
                      {locale === 'ja' ? '推奨' : 'Rec.'}
                    </span>
                  ) : null}
                </div>
                <span className="mt-1 block text-xs text-textSecondary/80">{description}</span>
              </Link>
            );
          })}
        </div>

        <footer className="mt-auto flex w-full flex-col items-center gap-4">
          <InstructionBanner tone="default">
            <span className="text-xs">
              {recommendedLocale === 'ja'
                ? 'このアプリはカメラとQuick Look対応のiOSデバイス（Safari）を利用します。利用を続けることで利用規約に同意したものとみなされます。'
                : 'This experience uses your camera and requires an iOS device with Quick Look support. Continuing means you agree to the Terms of Use.'}
            </span>
          </InstructionBanner>
          <div className="flex items-center gap-4 text-xs text-textSecondary/70">
            <Link href="/docs/terms" className="transition hover:text-textPrimary">
              {recommendedLocale === 'ja' ? '利用規約' : 'Terms'}
            </Link>
            <span className="h-3 w-px bg-divider" aria-hidden="true" />
            <Link href="/docs/privacy" className="transition hover:text-textPrimary">
              {recommendedLocale === 'ja' ? 'プライバシー' : 'Privacy'}
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
