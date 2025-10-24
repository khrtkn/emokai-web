"use client";

import { ReactNode } from "react";

export type ImageOptionProps = {
  id: string;
  image: ReactNode;
  label?: string;
  selected?: boolean;
  onSelect?: (id: string) => void;
  disabled?: boolean;
  size?: 'default' | 'compact';
};

export function ImageOption({ id, image, label, selected, onSelect, disabled, size = 'default' }: ImageOptionProps) {
  const handleClick = () => {
    if (disabled || !onSelect) return;
    onSelect(id);
  };

  const containerHeight = size === 'compact' ? 'h-32' : 'h-40';
  const labelPadding = size === 'compact' ? 'p-2.5 text-xs' : 'p-3 text-sm';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`group relative flex w-full flex-col rounded-3xl border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        selected ? "border-white/80 shadow-[0_0_0_2px_rgba(0,216,164,0.65)]" : "border-divider hover:border-accent"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <div className={`aspect-square w-full overflow-hidden rounded-3xl bg-[rgba(237,241,241,0.05)] ${containerHeight}`}>
        {image}
      </div>
      {label ? (
        <span className={`${labelPadding} text-left text-textSecondary group-hover:text-textPrimary`}>
          {label}
        </span>
      ) : null}
      {selected ? (
        <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-canvas">
          ✓
        </span>
      ) : null}
    </button>
  );
}

export default ImageOption;
