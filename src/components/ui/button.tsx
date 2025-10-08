import { ButtonHTMLAttributes, forwardRef, ReactNode } from "react";
import clsx from "clsx";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  showArrow?: boolean;
  variant?: "primary" | "secondary";
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className,
      leadingIcon,
      trailingIcon,
      showArrow = false,
      disabled,
      variant = "primary",
      ...props
    },
    ref
  ) => (
    <button
      ref={ref}
      className={clsx(
        "inline-flex min-h-[44px] items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary"
          ? "bg-accent text-black hover:opacity-90"
          : "border border-divider bg-transparent text-textSecondary hover:border-accent",
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
