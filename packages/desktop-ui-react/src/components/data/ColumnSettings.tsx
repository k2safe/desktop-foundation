import { useMemo, useState } from "react";
import { useLocale } from "../../locale";
import { Checkbox } from "../primitives/Checkbox";
import { Button } from "../primitives/Button";

export interface ColumnSettingItem {
  key: string;
  label: string;
  visible: boolean;
  width?: number;
  disabled?: boolean;
}

export interface ColumnSettingsProps {
  columns: ColumnSettingItem[];
  label?: string;
  resetLabel?: string;
  moveUpLabel?: string;
  moveDownLabel?: string;
  onChange: (columns: ColumnSettingItem[]) => void;
}

export function ColumnSettings({
  columns,
  label,
  resetLabel,
  moveUpLabel,
  moveDownLabel,
  onChange
}: ColumnSettingsProps) {
  const { t } = useLocale();
  const resolvedLabel = label ?? t("columns.settings");
  const resolvedResetLabel = resetLabel ?? t("columns.reset");
  const resolvedMoveUpLabel = moveUpLabel ?? t("columns.moveUp");
  const resolvedMoveDownLabel = moveDownLabel ?? t("columns.moveDown");
  const [open, setOpen] = useState(false);
  const visibleCount = useMemo(() => columns.filter((column) => column.visible).length, [columns]);

  function updateColumn(key: string, visible: boolean) {
    onChange(columns.map((column) => (column.key === key ? { ...column, visible } : column)));
  }

  function showAll() {
    onChange(columns.map((column) => ({ ...column, visible: true })));
  }

  function moveColumn(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= columns.length) return;
    const next = columns.slice();
    const [item] = next.splice(index, 1);
    next.splice(nextIndex, 0, item);
    onChange(next);
  }

  function updateWidth(key: string, width: number | undefined) {
    onChange(columns.map((column) => (column.key === key ? { ...column, width } : column)));
  }

  return (
    <div className="df-column-settings">
      <Button variant="outline" size="sm" onClick={() => setOpen((value) => !value)}>
        {resolvedLabel} ({visibleCount}/{columns.length})
      </Button>
      {open ? (
        <div className="df-column-settings__panel">
          <div className="df-column-settings__header">
            <strong>{resolvedLabel}</strong>
            <button type="button" onClick={showAll}>
              {resolvedResetLabel}
            </button>
          </div>
          <div className="df-column-settings__list">
            {columns.map((column, index) => (
              <div key={column.key} className="df-column-settings__item">
                <Checkbox
                  label={column.label}
                  checked={column.visible}
                  disabled={column.disabled}
                  onChange={(event) => updateColumn(column.key, event.target.checked)}
                />
                <input
                  aria-label={`${column.label} width`}
                  min={60}
                  placeholder="px"
                  type="number"
                  value={column.width ?? ""}
                  onChange={(event) => updateWidth(column.key, event.target.value ? Number(event.target.value) : undefined)}
                />
                <button type="button" disabled={index === 0} onClick={() => moveColumn(index, -1)}>
                  {resolvedMoveUpLabel}
                </button>
                <button type="button" disabled={index === columns.length - 1} onClick={() => moveColumn(index, 1)}>
                  {resolvedMoveDownLabel}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
