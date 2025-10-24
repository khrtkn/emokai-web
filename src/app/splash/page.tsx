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

function getHelperCopy(locale: string, isPrimary: boolean, isRecommended: boolean) {
  if (locale === 'ja') {
    if (isPrimary) {
      return isRecommended ? '推奨設定により日本語を選択しました' : '言語は設定からいつでも変更できます';
    }
    return '日本語に切り替える';
  }

  if (isPrimary) {
    return isRecommended ? 'Suggested for your device settings' : 'You can change the language anytime';
  }
  return 'Switch to English';
}

function SplashContent({ recommendedLocale }: { recommendedLocale: string }) {
  const locales = buildLocaleOptions(recommendedLocale);
  const primaryLocale = locales[0];
  return (
    <main className="relative overflow-hidden bg-canvas">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(0,216,164,0.35),_transparent_55%),_linear-gradient(160deg,_rgba(13,19,23,0.92)_0%,_rgba(8,12,14,0.98)_65%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-between gap-10 px-6 py-12">
        <header className="flex w-full flex-col items-center gap-4 text-center">
          <Image
            src="/Logo.png"
            alt="SOFU Emokai"
            width={124}
            height={60}
            className="h-[60px] w-auto"
            priority
          />
          <p className="text-sm text-textSecondary">
            {primaryLocale === 'ja'
              ? '感情から生まれる妖怪“エモカイ”を観測し、ARで呼び出す体験をはじめましょう。'
              : 'Observe the Emokai born from your emotions and bring them into AR.'}
          </p>
        </header>

        <div className="flex w-full flex-col items-stretch gap-3">
          {locales.map((locale, index) => {
            const isPrimary = index === 0;
            const isJapanese = locale === 'ja';
            const label = isJapanese ? '日本語で体験する' : 'Explore in English';
            const helper = getHelperCopy(locale, isPrimary, recommendedLocale === locale);
            return (
              <Link
                key={locale}
                href={`/${locale}`}
                className={`flex flex-col rounded-2xl border border-divider/40 bg-[rgba(12,18,20,0.75)] p-4 text-left transition hover:border-accent`}
              >
                <span className={`text-sm font-semibold text-textPrimary ${isPrimary ? '' : 'text-textPrimary/80'}`}>
                  {label}
                </span>
                <span className="mt-1 text-xs text-textSecondary/70">{helper}</span>
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
