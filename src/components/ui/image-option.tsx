"use client";

import { ReactNode } from "react";

export type ImageOptionProps = {
  id: string;
  image: ReactNode;
  label?: string;
  selected?: boolean;
  onSelect?: (id: string) => void;
  disabled?: boolean;
};

export function ImageOption({ id, image, label, selected, onSelect, disabled }: ImageOptionProps) {
  const handleClick = () => {
    if (disabled || !onSelect) return;
    onSelect(id);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`group relative flex w-full flex-col overflow-hidden rounded-xl border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        selected ? "border-transparent ring-2 ring-accent" : "border-divider hover:border-accent"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <div className="aspect-square w-full overflow-hidden bg-[rgba(237,241,241,0.05)]">
        {image}
      </div>
      {label ? (
        <span className="p-3 text-left text-sm text-textSecondary group-hover:text-textPrimary">
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
