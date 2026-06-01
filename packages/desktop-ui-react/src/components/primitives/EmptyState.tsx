import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div className={cn("df-empty", className)}>
      {icon ? <div className="df-empty__icon">{icon}</div> : null}
      <div className="df-empty__title">{title}</div>
      {description ? <div className="df-empty__description">{description}</div> : null}
      {action ? <div className="df-empty__action">{action}</div> : null}
    </div>
  );
}
