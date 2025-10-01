import { notFound, redirect } from 'next/navigation';

type Props = { params: { locale: string; id: string } };

export default function ScreenDemo({ params }: Props) {
  const { locale, id } = params;
  const num = parseInt(id, 10);
  if (Number.isNaN(num) || num < 1 || num > 15) notFound();
  redirect(`/${locale}/emokai/step/${num}`);
}
