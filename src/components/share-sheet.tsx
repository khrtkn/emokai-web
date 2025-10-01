"use client";

import { useMemo } from "react";

export type ShareSheetProps = {
  open: boolean;
  onClose: () => void;
  shareUrl: string;
  description: string;
};

const OPTIONS = [
  { id: "copy", label: "Copy URL" },
  { id: "qr", label: "Show QR" },
  { id: "twitter", label: "Share to X" },
  { id: "line", label: "Share to LINE" },
  { id: "facebook", label: "Share to Facebook" }
] as const;

export function ShareSheet({ open, onClose, shareUrl, description }: ShareSheetProps) {
  const content = useMemo(() => {
    if (!open) return null;
    return (
      <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 p-4">
        <div className="w-full max-w-md rounded-[32px] border border-divider bg-canvas/95 p-6 text-textSecondary">
          <header className="mb-4 flex items-center justify-between">
            <h2 className="heading-prosty">Share</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-sm uppercase tracking-[0.2em] text-textSecondary hover:text-textPrimary"
            >
              Close
            </button>
          </header>
          <div className="space-y-4 text-sm">
            <p>{description}</p>
            <div className="rounded-xl border border-divider bg-[rgba(237,241,241,0.08)] p-4">
              <p className="break-all text-textPrimary">{shareUrl}</p>
            </div>
            <ul className="space-y-2">
              {OPTIONS.map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    className="w-full rounded-xl border border-divider px-4 py-3 text-left text-textPrimary transition hover:border-accent"
                  >
                    {option.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }, [open, onClose, shareUrl, description]);

  return content;
}

export default ShareSheet;
