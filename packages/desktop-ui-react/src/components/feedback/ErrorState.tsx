import type { ReactNode } from "react";
import { useLocale } from "../../locale";
import { cn } from "../../utils/cn";

export interface ErrorStateProps {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function ErrorState({ title, description, action, className }: ErrorStateProps) {
  const { t } = useLocale();
  const resolvedTitle = title ?? t("error.title");

  return (
    <div className={cn("df-error-state", className)} role="alert">
      <div className="df-error-state__mark" aria-hidden="true">
        !
      </div>
      <div className="df-error-state__body">
        <div className="df-error-state__title">{resolvedTitle}</div>
        {description ? <div className="df-error-state__description">{description}</div> : null}
        {action ? <div className="df-error-state__action">{action}</div> : null}
      </div>
    </div>
  );
}
