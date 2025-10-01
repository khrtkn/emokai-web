import Link from 'next/link';

type Props = { params: { locale: string } };

const list = Array.from({ length: 15 }).map((_, i) => {
  const id = String(i + 1).padStart(2, '0');
  return { id, label: `Screen ${id}` };
});

export default function ScreensList({ params }: Props) {
  const { locale } = params;
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 bg-canvas px-6 py-12">
      <h1 className="text-xl font-semibold text-textPrimary">Reference Screens</h1>
      <ul className="grid grid-cols-1 gap-3">
        {list.map((it) => (
          <li key={it.id}>
            <Link
              href={`/${locale}/screens/${it.id}`}
              className="flex items-center justify-between rounded-xl border border-divider px-4 py-3 text-textPrimary transition hover:border-accent"
            >
              <span>{it.id}</span>
              <span className="text-xs text-textSecondary">/{locale}/screens/{it.id}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

