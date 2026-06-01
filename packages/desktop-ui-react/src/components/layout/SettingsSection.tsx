import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface SettingsSectionProps {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function SettingsSection({ title, description, children, actions, className }: SettingsSectionProps) {
  return (
    <section className={cn("df-settings-section", className)}>
      <div className="df-settings-section__aside">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
        {actions ? <div className="df-settings-section__actions">{actions}</div> : null}
      </div>
      <div className="df-settings-section__content">{children}</div>
    </section>
  );
}
