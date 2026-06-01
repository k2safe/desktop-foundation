import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface ContentPanelProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export function ContentPanel({ title, description, actions, children, className, ...props }: ContentPanelProps) {
  return (
    <section className={cn("df-content-panel", className)} {...props}>
      {title || description || actions ? (
        <div className="df-content-panel__header">
          <div>
            {title ? <h2>{title}</h2> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {actions ? <div className="df-content-panel__actions">{actions}</div> : null}
        </div>
      ) : null}
      <div className="df-content-panel__body">{children}</div>
    </section>
  );
}
