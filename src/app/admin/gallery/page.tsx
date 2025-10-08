import Link from 'next/link';
import { headers } from 'next/headers';

import { getServerEnv } from '@/lib/env';
import type { CreationStatus } from '@/lib/supabase/types';
import { updateCreationStatus } from './actions';

export const dynamic = 'force-dynamic';

interface ReviewAssetLinks {
  thumbnail: string | null;
  stage: string | null;
  character: string | null;
  composite: string | null;
  modelGlb: string | null;
  modelUsdz: string | null;
}

interface ReviewItem {
  id: string;
  slug: string;
  locale: string;
  status: CreationStatus;
  characterName: string;
  story: string | null;
  placeDescription: string | null;
  reasonDescription: string | null;
  actionDescription: string | null;
  appearanceDescription: string | null;
  stagePrompt: string | null;
  characterPrompt: string | null;
  compositeInstruction: string | null;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  emotionLevels: Record<string, number>;
  metadata: Record<string, unknown>;
  submittedAt: string;
  publishedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  moderationNotes: string | null;
  assets: ReviewAssetLinks;
}

interface ReviewResponse {
  items: ReviewItem[];
  nextCursor: string | null;
}

function getBaseUrl(): string {
  const hdrs = headers();
  const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host');
  const protocol = hdrs.get('x-forwarded-proto') ?? (host?.includes('localhost') ? 'http' : 'https');
  if (!host) throw new Error('Unable to resolve host');
  return `${protocol}://${host}`;
}

export default async function AdminGalleryPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { GALLERY_REVIEWER_TOKEN } = getServerEnv();
  const tokenParam = typeof searchParams.token === 'string' ? searchParams.token : undefined;
  const statusParam =
    typeof searchParams.status === 'string' && ['pending', 'published', 'rejected', 'archived'].includes(searchParams.status)
      ? (searchParams.status as CreationStatus)
      : 'pending';

  if (tokenParam !== GALLERY_REVIEWER_TOKEN) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12 text-sm text-textSecondary">
        <h1 className="text-lg font-semibold text-textPrimary">Reviewer Access Required</h1>
        <p className="mt-2">
          Provide a valid reviewer token via <code className="rounded bg-[rgba(255,255,255,0.08)] px-1 py-0.5">?token=</code>{' '}
          to continue.
        </p>
      </main>
    );
  }

  const response = await fetch(`${getBaseUrl()}/api/gallery/review?status=${statusParam}`, {
    headers: {
      Authorization: `Bearer ${GALLERY_REVIEWER_TOKEN}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12 text-sm text-textSecondary">
        <h1 className="text-lg font-semibold text-textPrimary">Reviewer Dashboard</h1>
        <p className="mt-2">Failed to load submissions. Please try again later.</p>
      </main>
    );
  }

  const { items }: ReviewResponse = await response.json();

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-12 text-sm">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-textPrimary">Reviewer Dashboard</h1>
          <p className="text-xs text-textSecondary">
            {statusParam === 'pending'
              ? 'Pending submissions ready for review.'
              : `Showing ${statusParam} entries.`}
          </p>
        </div>
        <nav className="flex gap-3 text-xs">
          {(
            [
              { label: 'Pending', value: 'pending' },
              { label: 'Published', value: 'published' },
              { label: 'Rejected', value: 'rejected' },
              { label: 'Archived', value: 'archived' },
            ] as const
          ).map((link) => {
            const active = statusParam === link.value;
            const href = `?token=${encodeURIComponent(GALLERY_REVIEWER_TOKEN)}&status=${link.value}`;
            return (
              <Link
                key={link.value}
                href={href}
                className={`rounded px-3 py-1 transition ${
                  active
                    ? 'bg-accent text-black'
                    : 'border border-divider text-textSecondary hover:border-accent'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {!items.length ? (
        <p className="rounded-2xl border border-divider p-6 text-textSecondary">
          No pending items. Check back later.
        </p>
      ) : (
        <div className="space-y-6">
          {items.map((item) => (
            <article key={item.id} className="space-y-4 rounded-2xl border border-divider p-6">
              <header className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-textPrimary">{item.characterName}</h2>
                  <span className="text-xs uppercase tracking-[0.2em] text-textSecondary">{item.slug}</span>
                </div>
                <p className="text-xs text-textSecondary">
                  Submitted {new Date(item.submittedAt).toLocaleString()} · Locale: {item.locale}
                </p>
              </header>

              <section className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-textSecondary">
                    Background
                  </h3>
                  <p className="text-textSecondary">{item.placeDescription || '—'}</p>
                  <p className="text-textSecondary">{item.reasonDescription || '—'}</p>
                  <p className="text-textSecondary">{item.actionDescription || '—'}</p>
                  <p className="text-textSecondary">{item.appearanceDescription || '—'}</p>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-textSecondary">
                    Story
                  </h3>
                  <p className="whitespace-pre-wrap text-textSecondary">{item.story || '—'}</p>
                </div>
              </section>

              <section className="grid gap-4 sm:grid-cols-3">
                <AssetPreview label="Thumbnail" href={item.assets.thumbnail} />
                <AssetPreview label="Composite" href={item.assets.composite} />
                <AssetPreview label="Stage" href={item.assets.stage} />
                <AssetPreview label="Character" href={item.assets.character} />
                <AssetPreview label="Model (GLB)" href={item.assets.modelGlb} />
                <AssetPreview label="Model (USDZ)" href={item.assets.modelUsdz} />
              </section>

              <form action={updateCreationStatus} className="space-y-3">
                <input type="hidden" name="slug" value={item.slug} />
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-textSecondary">
                      Moderation Notes
                    </label>
                    <textarea
                      name="moderationNotes"
                      defaultValue={item.moderationNotes ?? ''}
                      className="min-h-[96px] rounded-lg border border-divider bg-transparent px-3 py-2 text-sm text-textPrimary focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                  <div className="flex flex-col gap-3">
                    <button
                      className="rounded-lg bg-[#1BBF7A] px-3 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-60"
                      name="status"
                      value="published"
                      type="submit"
                      disabled={item.status === 'published'}
                    >
                      {item.status === 'published' ? 'Published' : 'Publish'}
                    </button>
                    <button
                      className="rounded-lg border border-divider px-3 py-2 text-sm text-textSecondary transition hover:border-accent"
                      name="status"
                      value="rejected"
                      type="submit"
                      disabled={item.status === 'rejected'}
                    >
                      {item.status === 'rejected' ? 'Rejected' : 'Reject'}
                    </button>
                  </div>
                </div>
              </form>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

function AssetPreview({ label, href }: { label: string; href: string | null }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-textSecondary">{label}</p>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-accent underline-offset-2 hover:underline"
        >
          Open
        </a>
      ) : (
        <p className="text-xs text-textSecondary">—</p>
      )}
    </div>
  );
}
