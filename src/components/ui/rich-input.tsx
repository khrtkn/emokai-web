"use client";

import { forwardRef } from "react";

export type RichInputProps = {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  helperText?: string;
  error?: string;
  rows?: number;
  showCounter?: boolean;
};

export const RichInput = forwardRef<HTMLTextAreaElement, RichInputProps>(function RichInput(
  { label, placeholder, value, onChange, maxLength, helperText, error, rows, showCounter },
  ref
) {
  const shouldShowCounter = showCounter !== false && typeof maxLength === "number";
  const characters = value.length;
  const isCompact = rows === 1;
  const textareaRows = rows ?? 6;
  const textareaHeightClass = isCompact ? "min-h-[44px]" : "h-40";
  const containerPadding = isCompact ? "py-2" : "py-3";

  return (
    <div className="space-y-2">
      {label ? <label className="block text-sm font-medium text-textPrimary">{label}</label> : null}
      <div
        className={`rounded-3xl border px-4 ${containerPadding} ${
          error ? "border-[#ff7c7c]" : "border-divider bg-[rgba(237,241,241,0.04)]"
        }`}
      >
        <textarea
          ref={ref}
          rows={textareaRows}
          className={`${textareaHeightClass} w-full resize-none bg-transparent text-sm text-textPrimary outline-none`}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={maxLength}
        />
        {error || helperText || shouldShowCounter ? (
          <div className="mt-2 flex justify-between text-xs text-textSecondary">
            {error ? <span className="text-[#ffb9b9]">{error}</span> : <span>{helperText}</span>}
            {shouldShowCounter ? <span>{characters}/{maxLength}</span> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
});

export default RichInput;
