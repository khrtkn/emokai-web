import Link from 'next/link';
import { notFound } from 'next/navigation';

import GalleryArLaunchButton from '@/components/gallery-ar-launch-button';
import { getCreationBySlug } from '@/lib/gallery/repository';
import { buildPublicAssetUrl, createSignedAssetUrl } from '@/lib/gallery/storage';

const emotionLabels: Record<string, { ja: string; en: string }> = {
  joy: { ja: '喜び', en: 'Joy' },
  trust: { ja: '信頼', en: 'Trust' },
  fear: { ja: '恐れ', en: 'Fear' },
  surprise: { ja: '驚き', en: 'Surprise' },
  sadness: { ja: '悲しみ', en: 'Sadness' },
  disgust: { ja: '嫌悪', en: 'Disgust' },
  anger: { ja: '怒り', en: 'Anger' },
  anticipation: { ja: '期待', en: 'Anticipation' },
};

interface PageParams {
  params: { locale: string; slug: string };
}

export default async function GalleryDetailPage({ params }: PageParams) {
  const creation = await getCreationBySlug(params.slug);
  if (!creation || creation.status !== 'published') {
    notFound();
  }

  const thumbnail = creation.thumbnailPath ? buildPublicAssetUrl(creation.thumbnailPath) : null;
  const composite = creation.compositePath ? buildPublicAssetUrl(creation.compositePath) : null;
  const glbUrl = creation.modelGlbPath
    ? await createSignedAssetUrl(creation.modelGlbPath, { scope: 'private', expiresIn: 60 * 15 }).catch(
        () => null,
      )
    : null;
  const usdzUrl = creation.modelUsdzPath
    ? await createSignedAssetUrl(creation.modelUsdzPath, { scope: 'private', expiresIn: 60 * 15 }).catch(
        () => null,
      )
    : null;

  const locale = params.locale;
  const isJa = locale === 'ja';

  const emotionEntries = Object.entries(creation.emotionLevels).map(([key, value]) => ({
    key,
    label: isJa ? emotionLabels[key]?.ja ?? key : emotionLabels[key]?.en ?? key,
    value,
  }));

  const locationSummary = (() => {
    if (creation.latitude == null || creation.longitude == null) {
      return null;
    }
    const lat = creation.latitude.toFixed(4);
    const lng = creation.longitude.toFixed(4);
    return `${isJa ? '緯度' : 'Lat'} ${lat} / ${isJa ? '経度' : 'Lng'} ${lng}`;
  })();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 bg-canvas px-6 py-12">
      <nav className="text-sm text-textSecondary">
        <Link href={`/${locale}/gallery`} className="hover:text-accent">
          {isJa ? 'ギャラリーに戻る' : 'Back to gallery'}
        </Link>
      </nav>

      <header className="space-y-2 text-textPrimary">
        <p className="text-xs uppercase tracking-[0.3em] text-textSecondary">
          {isJa ? '観測記録' : 'Observation'}
        </p>
        <h1 className="text-3xl font-semibold">{creation.characterName}</h1>
        <p className="text-xs text-textSecondary">
          {creation.publishedAt
            ? new Date(creation.publishedAt).toLocaleString(isJa ? 'ja-JP' : 'en-US')
            : null}
        </p>
      </header>

      {composite ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={composite}
          alt={creation.characterName}
          className="h-auto w-full rounded-3xl border border-divider object-cover"
        />
      ) : null}

      <section className="space-y-3 text-sm text-textSecondary">
        <h2 className="text-base font-semibold text-textPrimary">
          {isJa ? '物語' : 'Story'}
        </h2>
        <p className="whitespace-pre-wrap text-textPrimary">
          {creation.story || (isJa ? '記録された物語はありません。' : 'No story recorded.')}
        </p>
      </section>

      <section className="grid gap-4 text-sm text-textSecondary sm:grid-cols-2">
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-textSecondary">
            {isJa ? '場所の記録' : 'Place Notes'}
          </h3>
          <p>{creation.placeDescription || '—'}</p>
          <p>{creation.reasonDescription || '—'}</p>
          {locationSummary ? <p className="text-xs text-textSecondary/80">{locationSummary}</p> : null}
        </div>
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-textSecondary">
            {isJa ? '観測メモ' : 'Observation Notes'}
          </h3>
          <p>{creation.actionDescription || '—'}</p>
          <p>{creation.appearanceDescription || '—'}</p>
        </div>
      </section>

      <section className="space-y-3 text-sm text-textSecondary">
        <h2 className="text-base font-semibold text-textPrimary">
          {isJa ? '感情の構成' : 'Emotional Signature'}
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {emotionEntries.map((emotion) => (
            <div
              key={emotion.key}
              className="flex items-center justify-between rounded-2xl border border-divider px-4 py-2"
            >
              <span className="text-textPrimary">{emotion.label}</span>
              <span className="text-xs text-textSecondary">{emotion.value.toFixed(1)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3 text-sm text-textSecondary">
        <h2 className="text-base font-semibold text-textPrimary">
          {isJa ? 'ARで会う' : 'Meet in AR'}
        </h2>
        <div className="flex flex-col gap-3">
          <GalleryArLaunchButton
            locale={locale}
            slug={creation.slug}
            fallbackName={creation.characterName}
            fallbackStory={creation.story}
            fallbackComposite={composite}
            labels={{
              launch: isJa ? 'ARビューを開く' : 'Launch AR',
              preparing: isJa ? '起動準備中…' : 'Preparing…',
              error: isJa ? 'AR用のデータ取得に失敗しました。時間をおいて再試行してください。' : 'Failed to prepare AR assets. Please try again.',
            }}
          />
          <div className="flex flex-wrap gap-3">
            {glbUrl ? (
              <a
                href={glbUrl}
                className="rounded-lg border border-divider px-4 py-2 text-xs uppercase tracking-[0.2em] transition hover:border-accent"
              >
                Download GLB
              </a>
            ) : null}
            {usdzUrl ? (
              <a
                href={usdzUrl}
                className="rounded-lg border border-divider px-4 py-2 text-xs uppercase tracking-[0.2em] transition hover:border-accent"
              >
                Download USDZ
              </a>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
