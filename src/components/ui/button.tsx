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
        "gradient-border-button transition",
        disabled ? "cursor-not-allowed opacity-50" : "hover:opacity-90",
        className
      )}
      disabled={disabled}
      {...props}
    >
      <span className="flex items-center gap-2 text-sm">
        {leadingIcon}
        {children}
        {trailingIcon}
        {showArrow ? <span aria-hidden>›</span> : null}
      </span>
    </button>
  )
);

Button.displayName = "Button";
