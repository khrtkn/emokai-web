import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const SUPPORTED_LOCALES = new Set(["ja", "en"]);

type Props = {
  params: {
    locale: string;
  };
};

export default function LocaleHomePage({ params }: Props) {
  const { locale } = params;
  const target = SUPPORTED_LOCALES.has(locale) ? locale : "ja";
  redirect(`/${target}/emokai/step/1`);
}
