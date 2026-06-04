import type { ReactNode } from "react";
import { useLocale } from "../../locale";
import { cn } from "../../utils/cn";
import { EmptyState } from "../primitives/EmptyState";
import { Input } from "../primitives/Input";
import { Select, type SelectOption } from "../primitives/Select";

export interface EditableTableColumn<T> {
  key: string;
  header: ReactNode;
  accessor?: keyof T;
  width?: string | number;
  minWidth?: string | number;
  align?: "left" | "center" | "right";
  type?: "text" | "number" | "select";
  options?: SelectOption[];
  readOnly?: boolean;
  render?: (row: T, index: number) => ReactNode;
}

export interface EditableTableProps<T> {
  columns: EditableTableColumn<T>[];
  rows: T[];
  rowKey: keyof T | ((row: T, index: number) => string);
  emptyTitle?: ReactNode;
  className?: string;
  onCellChange?: (row: T, rowIndex: number, column: EditableTableColumn<T>, value: string) => void;
}

function getEditableRowKey<T>(row: T, index: number, rowKey: EditableTableProps<T>["rowKey"]) {
  if (typeof rowKey === "function") return rowKey(row, index);
  return String(row[rowKey]);
}

function getValue<T>(row: T, column: EditableTableColumn<T>) {
  if (!column.accessor) return "";
  return String(row[column.accessor] ?? "");
}

export function EditableTable<T>({ columns, rows, rowKey, emptyTitle, className, onCellChange }: EditableTableProps<T>) {
  const { t } = useLocale();
  const resolvedEmptyTitle = emptyTitle === undefined ? t("table.emptyTitle") : emptyTitle;

  return (
    <div className={cn("df-table-wrap df-editable-table", className)}>
      <table className="df-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} style={{ width: column.width, minWidth: column.minWidth, textAlign: column.align }}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, rowIndex) => (
              <tr key={getEditableRowKey(row, rowIndex, rowKey)}>
                {columns.map((column) => (
                  <td key={column.key} style={{ width: column.width, minWidth: column.minWidth, textAlign: column.align }}>
                    {column.render ? (
                      column.render(row, rowIndex)
                    ) : column.readOnly ? (
                      <span>{getValue(row, column)}</span>
                    ) : column.type === "select" ? (
                      <Select
                        value={getValue(row, column)}
                        options={column.options ?? []}
                        onChange={(event) => onCellChange?.(row, rowIndex, column, event.target.value)}
                      />
                    ) : (
                      <Input
                        type={column.type === "number" ? "number" : "text"}
                        value={getValue(row, column)}
                        onChange={(event) => onCellChange?.(row, rowIndex, column, event.target.value)}
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length}>
                <EmptyState title={resolvedEmptyTitle} />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
