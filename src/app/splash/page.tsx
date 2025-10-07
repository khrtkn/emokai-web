import { headers } from 'next/headers';
import Link from 'next/link';

function resolveLocaleFromHeader(): string {
  const acceptLanguage = headers().get('accept-language') ?? '';
  if (acceptLanguage.toLowerCase().startsWith('en')) return 'en';
  return 'ja';
}

type LocaleOption = {
  locale: string;
  label: string;
  description: string;
};

function buildLocaleOptions(recommended: string): LocaleOption[] {
  const options: LocaleOption[] = [
    {
      locale: "ja",
      label: "日本語ではじめる",
      description: "体験を日本語で楽しみます。",
    },
    {
      locale: "en",
      label: "Start in English",
      description: "Experience the flow in English.",
    },
  ];

  if (recommended === "ja") {
    return options;
  }
  if (recommended === "en") {
    return [options[1], options[0]];
  }
  return options;
}

function SplashContent({ recommendedLocale }: { recommendedLocale: string }) {
  const locales = buildLocaleOptions(recommendedLocale);
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-8 bg-canvas px-6 py-12">
      <div className="flex flex-col items-center gap-3">
        <div className="rounded-full border border-divider px-4 py-2 text-xs uppercase tracking-[0.3em] text-textSecondary">
          SOFU
        </div>
        <h1 className="text-2xl font-semibold text-textPrimary">AR Character Creator</h1>
        <p className="text-center text-sm text-textSecondary">
          Create, view, and share AI-generated characters in AR.
        </p>
      </div>
      <div className="w-full space-y-3">
        {locales.map((option, index) => {
          const isPrimary = index === 0;
          const baseClass = isPrimary
            ? "bg-accent text-black hover:opacity-90"
            : "border border-divider text-textPrimary hover:border-accent";
          return (
            <Link
              key={option.locale}
              href={`/${option.locale}`}
              className={`flex w-full flex-col gap-1 rounded-lg px-6 py-3 text-left text-base font-medium transition ${baseClass}`}
            >
              <span>{option.label}</span>
              <span className="text-xs font-normal text-textSecondary">{option.description}</span>
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
