import { headers } from 'next/headers';
import Link from 'next/link';

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
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-6 bg-canvas px-6 py-12">
      <div className="flex w-full flex-col items-center gap-4">
        {locales.map((locale, index) => {
          const isPrimary = index === 0;
          const baseClass = isPrimary
            ? 'bg-accent text-black hover:opacity-90'
            : 'bg-accent text-black/70 hover:opacity-90';
          return (
            <Link
              key={locale}
              href={`/${locale}`}
              className={`flex h-12 w-[128px] items-center justify-center rounded-full text-sm font-semibold transition ${baseClass}`}
            >
              {locale === 'ja' ? '日本語' : 'English'}
            </Link>
          );
        })}
      </div>
    </main>
  );
}

export default function SplashPage() {
  const recommendedLocale = resolveLocaleFromHeader();
  return <SplashContent recommendedLocale={recommendedLocale} />;
}
