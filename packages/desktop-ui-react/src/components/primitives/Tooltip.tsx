import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface TooltipProps extends HTMLAttributes<HTMLSpanElement> {
  label: ReactNode;
  children: ReactNode;
}

export function Tooltip({ label, children, className, ...props }: TooltipProps) {
  return (
    <span className={cn("df-tooltip", className)} {...props}>
      {children}
      <span className="df-tooltip__content" role="tooltip">
        {label}
      </span>
    </span>
  );
}
