import { useMemo, type ReactNode } from "react";
import { cn } from "../../utils/cn";
import { useLocale } from "../../locale";
import { Input } from "./Input";

export interface CommandPaletteItem {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  group?: string;
  keywords?: string[];
  shortcut?: ReactNode;
  disabled?: boolean;
}

export interface CommandPaletteProps {
  open: boolean;
  items: CommandPaletteItem[];
  value?: string;
  title?: ReactNode;
  placeholder?: string;
  emptyLabel?: ReactNode;
  closeLabel?: string;
  className?: string;
  onValueChange?: (value: string) => void;
  onSelect?: (item: CommandPaletteItem) => void;
  onClose: () => void;
}

function itemText(item: CommandPaletteItem) {
  return [item.id, item.label, item.description, item.group, ...(item.keywords ?? [])].join(" ").toLowerCase();
}

export function CommandPalette({
  open,
  items,
  value = "",
  title,
  placeholder,
  emptyLabel,
  closeLabel,
  className,
  onValueChange,
  onSelect,
  onClose
}: CommandPaletteProps) {
  const { t } = useLocale();
  const resolvedTitle = title === undefined ? t("command.title") : title;
  const resolvedPlaceholder = placeholder ?? t("command.search");
  const resolvedEmptyLabel = emptyLabel === undefined ? t("command.empty") : emptyLabel;
  const resolvedCloseLabel = closeLabel ?? t("command.close");

  const filtered = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => itemText(item).includes(query));
  }, [items, value]);

  const groups = useMemo(() => {
    const grouped = new Map<string, CommandPaletteItem[]>();
    filtered.forEach((item) => {
      const key = item.group ?? t("command.group");
      grouped.set(key, [...(grouped.get(key) ?? []), item]);
    });
    return Array.from(grouped.entries());
  }, [filtered, t]);

  if (!open) return null;

  return (
    <div className="df-overlay" role="presentation">
      <section className={cn("df-command-palette", className)} role="dialog" aria-modal="true">
        <div className="df-command-palette__header">
          <h2 className="df-command-palette__title">{resolvedTitle}</h2>
          <button className="df-close-button" type="button" aria-label={resolvedCloseLabel} onClick={onClose}>
            x
          </button>
        </div>
        <Input autoFocus value={value} placeholder={resolvedPlaceholder} onChange={(event) => onValueChange?.(event.target.value)} />
        <div className="df-command-palette__list">
          {groups.length ? (
            groups.map(([group, groupItems]) => (
              <div className="df-command-palette__group" key={group}>
                <div className="df-command-palette__group-label">{group}</div>
                {groupItems.map((item) => (
                  <button
                    key={item.id}
                    className="df-command-palette__item"
                    type="button"
                    disabled={item.disabled}
                    onClick={() => onSelect?.(item)}
                  >
                    <span className="df-command-palette__item-main">
                      <span className="df-command-palette__item-label">{item.label}</span>
                      {item.description ? <span className="df-command-palette__item-description">{item.description}</span> : null}
                    </span>
                    {item.shortcut ? <span className="df-command-palette__shortcut">{item.shortcut}</span> : null}
                  </button>
                ))}
              </div>
            ))
          ) : (
            <div className="df-command-palette__empty">{resolvedEmptyLabel}</div>
          )}
        </div>
      </section>
    </div>
  );
}
