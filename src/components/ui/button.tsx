import { ButtonHTMLAttributes, forwardRef, ReactNode } from "react";
import clsx from "clsx";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  showArrow?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, className, leadingIcon, trailingIcon, showArrow = false, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={clsx(
        "inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      disabled={disabled}
      {...props}
    >
      <span className="flex items-center gap-2">
        {leadingIcon}
        {children}
        {trailingIcon}
        {showArrow ? <span aria-hidden>›</span> : null}
      </span>
    </button>
  )
);

Button.displayName = "Button";
