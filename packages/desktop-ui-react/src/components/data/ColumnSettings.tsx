import { useMemo, useState } from "react";
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
  label = "列设置",
  resetLabel = "全部显示",
  moveUpLabel = "上移",
  moveDownLabel = "下移",
  onChange
}: ColumnSettingsProps) {
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
        {label} ({visibleCount}/{columns.length})
      </Button>
      {open ? (
        <div className="df-column-settings__panel">
          <div className="df-column-settings__header">
            <strong>{label}</strong>
            <button type="button" onClick={showAll}>
              {resetLabel}
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
                  {moveUpLabel}
                </button>
                <button type="button" disabled={index === columns.length - 1} onClick={() => moveColumn(index, 1)}>
                  {moveDownLabel}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
