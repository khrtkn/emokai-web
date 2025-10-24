import { ReactNode } from 'react';
import clsx from 'clsx';

type ScreenBackgroundProps = {
  children: ReactNode;
  className?: string;
  overlayClassName?: string;
};

export function ScreenBackground({ children, className, overlayClassName }: ScreenBackgroundProps) {
  return (
    <div className={clsx('relative min-h-screen w-full bg-canvas', className)}>
      <div
        aria-hidden
        className={clsx(
          'pointer-events-none absolute inset-0',
          'bg-[radial-gradient(circle_at_top,_rgba(0,216,164,0.28),transparent_55%),_linear-gradient(160deg,_rgba(17,24,28,0.96)_0%,_rgba(8,12,14,0.98)_70%)]',
          overlayClassName,
        )}
      />
      <div className="relative min-h-screen">{children}</div>
    </div>
  );
}

export default ScreenBackground;

