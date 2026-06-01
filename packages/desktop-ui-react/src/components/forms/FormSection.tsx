import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface FormSectionProps {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function FormSection({ title, description, children, actions, className }: FormSectionProps) {
  return (
    <section className={cn("df-form-section", className)}>
      {title || description || actions ? (
        <header className="df-form-section__header">
          <div>
            {title ? <h3>{title}</h3> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {actions ? <div className="df-form-section__actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className="df-form-section__body">{children}</div>
    </section>
  );
}
