import { useMemo, type ReactNode } from "react";
import { cn } from "../../utils/cn";
import { useLocale } from "../../locale";
import { EmptyState } from "../primitives/EmptyState";
import { LoadingBlock } from "../primitives/LoadingBlock";

export type TableSortDirection = "asc" | "desc";

export interface TableSortState {
  key: string;
  direction: TableSortDirection;
}

export interface TableColumn<T> {
  key: string;
  header: ReactNode;
  width?: string | number;
  minWidth?: string | number;
  maxWidth?: string | number;
  align?: "left" | "center" | "right";
  sticky?: "left" | "right";
  sortable?: boolean;
  accessor?: keyof T;
  render?: (row: T, index: number) => ReactNode;
  sortValue?: (row: T) => string | number | Date | null | undefined;
  className?: string;
  headerClassName?: string;
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: keyof T | ((row: T, index: number) => string);
  sort?: TableSortState | null;
  sortMode?: "manual" | "client";
  selectable?: boolean;
  selectedRowKeys?: string[];
  loading?: boolean;
  emptyTitle?: ReactNode;
  emptyDescription?: ReactNode;
  className?: string;
  selectAllLabel?: string;
  onRowClick?: (row: T, index: number) => void;
  onSortChange?: (sort: TableSortState | null) => void;
  onSelectedRowKeysChange?: (keys: string[], rows: T[]) => void;
  isRowSelectionDisabled?: (row: T, index: number) => boolean;
  rowClassName?: (row: T, index: number) => string | undefined;
  density?: "compact" | "default" | "comfortable";
}

function getCellValue<T>(row: T, column: TableColumn<T>, index: number) {
  if (column.render) return column.render(row, index);
  if (column.accessor) return row[column.accessor] as ReactNode;
  return null;
}

function getRowKey<T>(row: T, index: number, rowKey: TableProps<T>["rowKey"]) {
  if (typeof rowKey === "function") return rowKey(row, index);
  return String(row[rowKey]);
}

function compareValues(left: unknown, right: unknown) {
  if (left instanceof Date) left = left.getTime();
  if (right instanceof Date) right = right.getTime();
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left ?? "").localeCompare(String(right ?? ""), undefined, { numeric: true, sensitivity: "base" });
}

function getSortValue<T>(row: T, column: TableColumn<T>) {
  if (column.sortValue) return column.sortValue(row);
  if (column.accessor) return row[column.accessor];
  return "";
}

function getNextSort(current: TableSortState | null | undefined, columnKey: string): TableSortState | null {
  if (!current || current.key !== columnKey) return { key: columnKey, direction: "asc" };
  if (current.direction === "asc") return { key: columnKey, direction: "desc" };
  return null;
}

export function Table<T>({
  columns,
  rows,
  rowKey,
  sort,
  sortMode = "manual",
  selectable,
  selectedRowKeys = [],
  loading,
  emptyTitle,
  emptyDescription,
  className,
  selectAllLabel,
  onRowClick,
  onSortChange,
  onSelectedRowKeysChange,
  isRowSelectionDisabled,
  rowClassName,
  density = "default"
}: TableProps<T>) {
  const { t } = useLocale();
  const resolvedEmptyTitle = emptyTitle ?? t("table.emptyTitle");
  const resolvedSelectAllLabel = selectAllLabel ?? t("table.selectAll");
  const sortedRows = useMemo(() => {
    if (sortMode !== "client" || !sort) return rows;
    const column = columns.find((item) => item.key === sort.key);
    if (!column) return rows;
    return rows.slice().sort((left, right) => {
      const result = compareValues(getSortValue(left, column), getSortValue(right, column));
      return sort.direction === "asc" ? result : -result;
    });
  }, [columns, rows, sort, sortMode]);

  const rowEntries = sortedRows.map((row, index) => ({
    row,
    index,
    key: getRowKey(row, index, rowKey),
    disabled: isRowSelectionDisabled?.(row, index) ?? false
  }));
  const selectableEntries = rowEntries.filter((entry) => !entry.disabled);
  const selectedKeySet = new Set(selectedRowKeys);
  const allSelected = selectableEntries.length > 0 && selectableEntries.every((entry) => selectedKeySet.has(entry.key));
  const partiallySelected = selectableEntries.some((entry) => selectedKeySet.has(entry.key)) && !allSelected;
  const colSpan = columns.length + (selectable ? 1 : 0);

  function updateSelection(keys: string[]) {
    const keySet = new Set(keys);
    onSelectedRowKeysChange?.(
      keys,
      rowEntries.filter((entry) => keySet.has(entry.key)).map((entry) => entry.row)
    );
  }

  function toggleAll(checked: boolean) {
    if (checked) {
      updateSelection(Array.from(new Set([...selectedRowKeys, ...selectableEntries.map((entry) => entry.key)])));
      return;
    }
    const visibleKeys = new Set(selectableEntries.map((entry) => entry.key));
    updateSelection(selectedRowKeys.filter((key) => !visibleKeys.has(key)));
  }

  function toggleRow(key: string, checked: boolean) {
    if (checked) {
      updateSelection(Array.from(new Set([...selectedRowKeys, key])));
      return;
    }
    updateSelection(selectedRowKeys.filter((item) => item !== key));
  }

  return (
    <div className={cn("df-table-wrap", `df-table-wrap--${density}`, className)}>
      <table className="df-table">
        <thead>
          <tr>
            {selectable ? (
              <th className="df-table__selection-cell">
                <input
                  aria-label={resolvedSelectAllLabel}
                  checked={allSelected}
                  ref={(node) => {
                    if (node) node.indeterminate = partiallySelected;
                  }}
                  type="checkbox"
                  onChange={(event) => toggleAll(event.target.checked)}
                />
              </th>
            ) : null}
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn(column.sticky && `is-sticky-${column.sticky}`, column.headerClassName)}
                style={{ width: column.width, minWidth: column.minWidth, maxWidth: column.maxWidth, textAlign: column.align }}
              >
                {column.sortable ? (
                  <button className="df-table__sort-button" type="button" onClick={() => onSortChange?.(getNextSort(sort, column.key))}>
                    <span>{column.header}</span>
                    <span className={cn("df-table__sort-indicator", sort?.key === column.key && `is-${sort.direction}`)} aria-hidden="true" />
                  </button>
                ) : (
                  column.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={colSpan}>
                <LoadingBlock rows={4} />
              </td>
            </tr>
          ) : rowEntries.length ? (
            rowEntries.map(({ row, index: rowIndex, key, disabled }) => (
              <tr
                key={key}
                className={cn(onRowClick && "is-clickable", selectedKeySet.has(key) && "is-selected", rowClassName?.(row, rowIndex))}
                onClick={() => onRowClick?.(row, rowIndex)}
              >
                {selectable ? (
                  <td className="df-table__selection-cell" onClick={(event) => event.stopPropagation()}>
                    <input
                      aria-label={t("table.selectRow", { key }, `Select row ${key}`)}
                      checked={selectedKeySet.has(key)}
                      disabled={disabled}
                      type="checkbox"
                      onChange={(event) => toggleRow(key, event.target.checked)}
                    />
                  </td>
                ) : null}
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(column.sticky && `is-sticky-${column.sticky}`, column.className)}
                    style={{ width: column.width, minWidth: column.minWidth, maxWidth: column.maxWidth, textAlign: column.align }}
                  >
                    {getCellValue(row, column, rowIndex)}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={colSpan}>
                <EmptyState title={resolvedEmptyTitle} description={emptyDescription} />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
