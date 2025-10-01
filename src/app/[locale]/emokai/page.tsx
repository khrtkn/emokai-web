import { redirect } from 'next/navigation';

type Props = { params: { locale: string } };

export default function EmokaiRoot({ params }: Props) {
  redirect(`/${params.locale}/emokai/step/1`);
}

