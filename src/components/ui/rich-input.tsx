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
};

export const RichInput = forwardRef<HTMLTextAreaElement, RichInputProps>(function RichInput(
  { label, placeholder, value, onChange, maxLength, helperText, error },
  ref
) {
  const showCounter = typeof maxLength === "number";
  const characters = value.length;

  return (
    <div className="space-y-2">
      {label ? <label className="block text-sm font-medium text-textPrimary">{label}</label> : null}
      <div
        className={`rounded-3xl border px-4 py-3 ${
          error ? "border-[#ff7c7c]" : "border-divider bg-[rgba(237,241,241,0.04)]"
        }`}
      >
        <textarea
          ref={ref}
          className="h-40 w-full resize-none bg-transparent text-sm text-textPrimary outline-none"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={maxLength}
        />
        <div className="mt-2 flex justify-between text-xs text-textSecondary">
          {error ? <span className="text-[#ffb9b9]">{error}</span> : <span>{helperText}</span>}
          {showCounter ? <span>{characters}/{maxLength}</span> : null}
        </div>
      </div>
    </div>
  );
});

export default RichInput;
