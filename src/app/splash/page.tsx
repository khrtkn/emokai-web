import { headers } from 'next/headers';
import Link from 'next/link';

function resolveLocaleFromHeader(): string {
  const acceptLanguage = headers().get('accept-language') ?? '';
  if (acceptLanguage.toLowerCase().startsWith('en')) return 'en';
  return 'ja';
}

function SplashContent({ locale }: { locale: string }) {
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
      <Link
        href={`/${locale}`}
        className="rounded-lg bg-accent px-6 py-3 text-base font-medium text-black transition hover:opacity-90"
      >
        Start
      </Link>
    </main>
  );
}

export default function SplashPage() {
  const locale = resolveLocaleFromHeader();
  return <SplashContent locale={locale} />;
}

