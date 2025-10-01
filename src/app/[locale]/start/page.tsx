import { redirect } from "next/navigation";
import { Suspense } from "react";
import TermsGate from "@/components/terms-gate";
import type { Locale } from "@/lib/i18n/messages";

type StartPageProps = {
  params: {
    locale: Locale;
  };
  searchParams: Record<string, string | string[] | undefined>;
};

export default function StartPage({ params, searchParams }: StartPageProps) {
  const locale = params.locale;
  const accepted = searchParams?.accepted === "true";

  if (accepted) {
    redirect(`/${locale}/stage`);
  }

  return (
    <Suspense fallback={<div className="px-6 py-12 text-sm text-textSecondary">Loading…</div>}>
      <TermsGate locale={locale} />
    </Suspense>
  );
}
