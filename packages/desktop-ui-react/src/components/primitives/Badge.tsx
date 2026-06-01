import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";

export type BadgeTone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  children: ReactNode;
}

export function Badge({ tone = "neutral", className, children, ...props }: BadgeProps) {
  return (
    <span className={cn("df-badge", `df-badge--${tone}`, className)} {...props}>
      {children}
    </span>
  );
}
