import { useId, type ReactNode } from 'react';

type LoadingVariant = 'stage' | 'character' | 'creation';

type LoadingScreenProps = {
  visible: boolean;
  variant: LoadingVariant;
  title: string;
  message?: ReactNode;
  footer?: ReactNode;
  mode?: 'overlay' | 'page';
};

const VARIANT_ASSETS: Record<LoadingVariant, { src: string; alt: string }> = {
  stage: {
    src: '/loading/stage-loop.gif',
    alt: 'Scenery generation animation',
  },
  character: {
    src: '/loading/character-loop.gif',
    alt: 'Character generation animation',
  },
  creation: {
    src: '/loading/creation-loop.gif',
    alt: 'Creation process animation',
  },
};

export function LoadingScreen({
  visible,
  variant,
  title,
  message,
  footer,
  mode = 'overlay',
}: LoadingScreenProps) {
  const titleId = useId();
  const descriptionId = useId();

  if (!visible) return null;

  const asset = VARIANT_ASSETS[variant];

  const content = (
    <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-[rgba(237,241,241,0.12)] bg-[rgba(10,14,14,0.96)] p-6 text-center shadow-2xl">
      <img src={asset.src} alt={asset.alt} className="h-32 w-32 object-contain" loading="lazy" />
      <div className="space-y-2">
        <p id={titleId} className="text-sm font-semibold text-textPrimary">
          {title}
        </p>
        {message ? (
          <div id={descriptionId} className="text-xs leading-5 text-textSecondary" role="status">
            {message}
          </div>
        ) : null}
      </div>
      {footer ? <div className="w-full">{footer}</div> : null}
    </div>
  );

  if (mode === 'page') {
    return (
      <section
        className="flex min-h-[60vh] w-full flex-col items-center justify-center px-4 text-center"
        role="status"
        aria-labelledby={titleId}
        aria-describedby={message ? descriptionId : undefined}
      >
        {content}
      </section>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-[rgba(8,12,12,0.78)] backdrop-blur"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={message ? descriptionId : undefined}
    >
      <div className="mx-4 flex w-full justify-center">{content}</div>
    </div>
  );
}

export type { LoadingScreenProps, LoadingVariant };
