import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../utils/cn";
import type { ButtonVariant } from "./Button";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: ReactNode;
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, label, icon, variant = "ghost", size = "md", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={props.title ?? label}
      className={cn("df-icon-button", `df-button--${variant}`, `df-icon-button--${size}`, className)}
      {...props}
    >
      {icon}
    </button>
  )
);

IconButton.displayName = "IconButton";
