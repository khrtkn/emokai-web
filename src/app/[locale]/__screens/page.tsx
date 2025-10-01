import Link from 'next/link';
import { Divider, Header, InstructionBanner } from '@/components/ui';

type Props = { params: { locale: string } };

const items = [
  { id: '01', label: 'ScreenMessage – Info', path: (l: string) => `/${l}/start` },
  { id: '02', label: 'ScreenMessage – Warning', path: (l: string) => `/${l}/start?state=warn` },
  { id: '03', label: 'ScreenMessage – Error', path: (l: string) => `/${l}/start?state=error` },
  { id: '04', label: 'ScreenMessage – Complete', path: (l: string) => `/${l}/start?state=done` },
  { id: '05', label: 'ScreenMessage – Notice', path: (l: string) => `/${l}/start?state=notice` },
  { id: '06', label: 'ScreenInput – Stage (idle)', path: (l: string) => `/${l}/stage` },
  { id: '07', label: 'ScreenInput – Stage (generating)', path: (l: string) => `/${l}/stage?state=generating` },
  { id: '08', label: 'ScreenInput – Character (idle)', path: (l: string) => `/${l}/character` },
  { id: '09', label: 'ScreenInput – Character (generating)', path: (l: string) => `/${l}/character?state=generating` },
  { id: '10', label: 'ScreenInput – Error', path: (l: string) => `/${l}/stage?state=error` },
  { id: '11', label: 'ScreenImageSelection – Stage', path: (l: string) => `/${l}/stage?state=ready` },
  { id: '12', label: 'ScreenImageSelection – Character', path: (l: string) => `/${l}/character?state=ready` },
  { id: '13', label: 'ScreenImageSelection – Emotion (optional)', path: (l: string) => `/${l}/character?variant=emotion` },
  { id: '14', label: 'ScreenEmokaiCard – Story', path: (l: string) => `/${l}/result` },
  { id: '15', label: 'ScreenCamera – AR/3D', path: (l: string) => `/${l}/ar` },
  { id: 'Gallery', label: 'Gallery', path: (l: string) => `/${l}/gallery` },
  { id: 'Splash', label: 'Splash', path: () => `/splash` },
  { id: 'Consent', label: 'Terms / Consent', path: (l: string) => `/${l}/start` },
  { id: 'Language', label: 'Language Select', path: (l: string) => `/${l}` }
];

export default function ScreensIndex({ params }: Props) {
  const locale = params.locale;
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-canvas">
      <Header title={`Screens (${locale})`} />
      <Divider />
      <div className="space-y-6 px-4 py-6 sm:px-6">
        <InstructionBanner tone="default">
          Development-only index to jump between reference screens.
        </InstructionBanner>
        <ul className="grid grid-cols-1 gap-3">
          {items.map((it) => (
            <li key={it.id}>
              <Link
                href={it.path(locale)}
                className="flex items-center justify-between rounded-xl border border-divider px-4 py-3 text-textPrimary transition hover:border-accent"
              >
                <span className="text-sm">{it.id}. {it.label}</span>
                <span className="text-xs text-textSecondary">{it.path(locale)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

