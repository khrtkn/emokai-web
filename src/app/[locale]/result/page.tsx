import { redirect } from "next/navigation";

type Props = {
  params: {
    locale: string;
  };
};

export default function ResultRedirect({ params }: Props) {
  const { locale } = params;
  redirect(`/${locale}/emokai/step/14`);
}
