import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface FilterBarProps {
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function FilterBar({ children, actions, className }: FilterBarProps) {
  return (
    <div className={cn("df-filter-bar", className)}>
      <div className="df-filter-bar__fields">{children}</div>
      {actions ? <div className="df-filter-bar__actions">{actions}</div> : null}
    </div>
  );
}
