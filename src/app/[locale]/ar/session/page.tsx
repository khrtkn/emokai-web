import { notFound } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { Divider, Header, InstructionBanner } from "@/components/ui";
import { detectDeviceType } from "@/lib/device";

type ARSessionPageProps = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default function ARSessionPage({ searchParams }: ARSessionPageProps) {
  const modeParam = searchParams?.mode;
  const mode = Array.isArray(modeParam) ? modeParam[0] : modeParam;
  const currentMode = mode === "fallback" ? "fallback" : mode === "ar" ? "ar" : "ar";

  if (modeParam && currentMode !== modeParam && modeParam !== "ar" && modeParam !== "fallback") {
    notFound();
  }

  const t = useTranslations("ar");
  const locale = useLocale();
  const device = detectDeviceType();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-canvas">
      <Header
        title={currentMode === "ar" ? t("session.title") : t("session.fallbackTitle")}
        action={{
          type: "link",
          label: t("session.back"),
          href: `/${locale}/result`,
          showArrow: false
        }}
      />
      <Divider />
      <div className="space-y-6 px-4 py-6 sm:px-6">
        <InstructionBanner tone="default">
          {currentMode === "ar" ? t("session.instructions") : t("session.fallbackInstructions")}
        </InstructionBanner>
        <div className="rounded-3xl border border-divider bg-[rgba(255,255,255,0.05)] p-6 text-sm text-textSecondary">
          {currentMode === "ar"
            ? t("session.arPlaceholder", { device: t(`device.${device}`) })
            : t("session.viewerPlaceholder")}
        </div>
      </div>
    </main>
  );
}
