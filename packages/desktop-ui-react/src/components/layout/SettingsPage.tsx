import type { ReactNode } from "react";
import { useAccess, type AccessControlled } from "../../access";
import { useLocale } from "../../locale";
import { cn } from "../../utils/cn";
import { SettingsSection } from "./SettingsSection";

export interface SettingsPageSection extends AccessControlled {
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
  const { t } = useLocale();
  const { canAccess } = useAccess();
  const visibleSections = sections.filter((section) => canAccess(section));
  const resolvedActiveSectionId = visibleSections.some((section) => section.id === activeSectionId) ? activeSectionId : visibleSections[0]?.id;

  return (
    <div className={cn("df-settings-page", className)}>
      <nav className="df-settings-page__nav" aria-label={t("settings.sections")}>
        {visibleSections.map((section) => (
          <button
            key={section.id}
            className={cn("df-settings-page__nav-item", section.id === resolvedActiveSectionId && "is-active")}
            type="button"
            onClick={() => onSectionSelect?.(section)}
          >
            {section.title}
          </button>
        ))}
      </nav>
      <div className="df-settings-page__content">
        {visibleSections
          .filter((section) => section.id === resolvedActiveSectionId)
          .map((section) => (
            <SettingsSection key={section.id} title={section.title} description={section.description} actions={section.actions}>
              {section.content}
            </SettingsSection>
          ))}
      </div>
    </div>
  );
}
