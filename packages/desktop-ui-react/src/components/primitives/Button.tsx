import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../utils/cn";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading,
      disabled,
      type = "button",
      leftIcon,
      rightIcon,
      children,
      ...props
    },
    ref
  ) => (
    <button
      ref={ref}
      type={type}
      className={cn("df-button", `df-button--${variant}`, `df-button--${size}`, loading && "is-loading", className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <span className="df-spinner" aria-hidden="true" /> : leftIcon}
      <span className="df-button__label">{children}</span>
      {!loading ? rightIcon : null}
    </button>
  )
);

Button.displayName = "Button";
