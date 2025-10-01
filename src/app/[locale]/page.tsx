import Link from "next/link";
import HomeGalleryShortcut from "@/components/HomeGalleryShortcut";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-10 px-6 py-12">
      <section className="flex flex-col gap-4 text-center">
        <h1 className="text-2xl font-semibold">SOFU AR Character Creator</h1>
        <p className="text-sm text-textSecondary">
          Kick off the onboarding flow by choosing your language and reviewing the required permissions.
        </p>
      </section>
      <div className="flex flex-col gap-4">
        <Link
          href="/ja/start"
          className="rounded-lg bg-accent px-4 py-3 text-center text-base font-medium text-black transition hover:opacity-90"
        >
          日本語で始める
        </Link>
        <Link
          href="/en/start"
          className="rounded-lg border border-divider px-4 py-3 text-center text-base font-medium text-textPrimary transition hover:border-accent"
        >
          Start in English
        </Link>
        <HomeGalleryShortcut />
      </div>
    </main>
  );
}
