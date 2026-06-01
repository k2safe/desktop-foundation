import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface ErrorStateProps {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function ErrorState({ title = "出现错误", description, action, className }: ErrorStateProps) {
  return (
    <div className={cn("df-error-state", className)} role="alert">
      <div className="df-error-state__mark" aria-hidden="true">
        !
      </div>
      <div className="df-error-state__body">
        <div className="df-error-state__title">{title}</div>
        {description ? <div className="df-error-state__description">{description}</div> : null}
        {action ? <div className="df-error-state__action">{action}</div> : null}
      </div>
    </div>
  );
}
