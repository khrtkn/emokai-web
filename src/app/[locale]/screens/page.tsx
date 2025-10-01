import Link from 'next/link';

type Props = { params: { locale: string } };

const labels: Record<string, string> = {
  '01': '01_ScreenMessage',
  '02': '02_ScreenMessage',
  '03': '03_ScreenMessage',
  '04': '04_ScreenMessage',
  '05': '05_ScreenMessage',
  '06': '06_ScreenInput',
  '07': '07_ScreenInput',
  '08': '08_ScreenInput',
  '09': '09_ScreenInput',
  '10': '10_ScreenInput',
  '11': '11_ScreenImageSelection',
  '12': '12_ScreenImageSelection',
  '13': '13_ScreenImageSelection',
  '14': '14_ScreenEmokaiCard',
  '15': '15_ScreenCamera'
};

const list = Object.keys(labels).map((id) => ({ id, label: labels[id] }));

export default function ScreensList({ params }: Props) {
  const { locale } = params;
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 bg-canvas px-6 py-12">
      <h1 className="text-xl font-semibold text-textPrimary">Reference Screens</h1>
      <ul className="grid grid-cols-1 gap-3">
        {list.map((it) => (
          <li key={it.id}>
              <Link
                href={`/${locale}/emokai/step/${Number(it.id)}`}
                className="flex items-center justify-between rounded-xl border border-divider px-4 py-3 text-textPrimary transition hover:border-accent"
              >
                <span>{it.label}</span>
                <span className="text-xs text-textSecondary">/{locale}/emokai/step/{Number(it.id)}</span>
              </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
