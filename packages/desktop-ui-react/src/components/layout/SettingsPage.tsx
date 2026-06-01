import type { ReactNode } from "react";
import { cn } from "../../utils/cn";
import { SettingsSection } from "./SettingsSection";

export interface SettingsPageSection {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  content: ReactNode;
  actions?: ReactNode;
}

export interface SettingsPageProps {
  sections: SettingsPageSection[];
  activeSectionId?: string;
  className?: string;
  onSectionSelect?: (section: SettingsPageSection) => void;
}

export function SettingsPage({ sections, activeSectionId = sections[0]?.id, className, onSectionSelect }: SettingsPageProps) {
  return (
    <div className={cn("df-settings-page", className)}>
      <nav className="df-settings-page__nav" aria-label="Settings sections">
        {sections.map((section) => (
          <button
            key={section.id}
            className={cn("df-settings-page__nav-item", section.id === activeSectionId && "is-active")}
            type="button"
            onClick={() => onSectionSelect?.(section)}
          >
            {section.title}
          </button>
        ))}
      </nav>
      <div className="df-settings-page__content">
        {sections
          .filter((section) => section.id === activeSectionId)
          .map((section) => (
            <SettingsSection key={section.id} title={section.title} description={section.description} actions={section.actions}>
              {section.content}
            </SettingsSection>
          ))}
      </div>
    </div>
  );
}
