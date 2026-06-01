import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  tabs?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, eyebrow, actions, tabs, className }: PageHeaderProps) {
  return (
    <header className={cn("df-page-header", className)}>
      <div className="df-page-header__main">
        {eyebrow ? <div className="df-page-header__eyebrow">{eyebrow}</div> : null}
        <div className="df-page-header__title-row">
          <div>
            <h1>{title}</h1>
            {description ? <p>{description}</p> : null}
          </div>
          {actions ? <div className="df-page-header__actions">{actions}</div> : null}
        </div>
      </div>
      {tabs ? <div className="df-page-header__tabs">{tabs}</div> : null}
    </header>
  );
}
