import { useMemo, type ReactNode } from "react";
import { cn } from "../../utils/cn";
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
  title = "Command",
  placeholder = "Search",
  emptyLabel = "No commands",
  closeLabel = "Close",
  className,
  onValueChange,
  onSelect,
  onClose
}: CommandPaletteProps) {
  const filtered = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => itemText(item).includes(query));
  }, [items, value]);

  const groups = useMemo(() => {
    const grouped = new Map<string, CommandPaletteItem[]>();
    filtered.forEach((item) => {
      const key = item.group ?? "Commands";
      grouped.set(key, [...(grouped.get(key) ?? []), item]);
    });
    return Array.from(grouped.entries());
  }, [filtered]);

  if (!open) return null;

  return (
    <div className="df-overlay" role="presentation">
      <section className={cn("df-command-palette", className)} role="dialog" aria-modal="true">
        <div className="df-command-palette__header">
          <h2 className="df-command-palette__title">{title}</h2>
          <button className="df-close-button" type="button" aria-label={closeLabel} onClick={onClose}>
            x
          </button>
        </div>
        <Input autoFocus value={value} placeholder={placeholder} onChange={(event) => onValueChange?.(event.target.value)} />
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
            <div className="df-command-palette__empty">{emptyLabel}</div>
          )}
        </div>
      </section>
    </div>
  );
}
