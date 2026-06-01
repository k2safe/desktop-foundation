import { useMemo } from "react";
import type { ColumnSettingItem } from "../components/data/ColumnSettings";
import type { TableColumn, TableSortState } from "../components/data/Table";
import { useLocalPreference } from "./useLocalPreference";

export interface TablePreferences {
  columns: ColumnSettingItem[];
  sort: TableSortState | null;
  pageSize: number;
  density: "compact" | "default" | "comfortable";
}

export interface UseTablePreferencesOptions<T> {
  key: string;
  columns: TableColumn<T>[];
  defaultSort?: TableSortState | null;
  defaultPageSize?: number;
  defaultDensity?: TablePreferences["density"];
}

function makeDefaultColumns<T>(columns: TableColumn<T>[]): ColumnSettingItem[] {
  return columns.map((column) => ({
    key: column.key,
    label: typeof column.header === "string" ? column.header : column.key,
    visible: true,
    width: typeof column.width === "number" ? column.width : undefined
  }));
}

export function useTablePreferences<T>({
  key,
  columns,
  defaultSort = null,
  defaultPageSize = 20,
  defaultDensity = "default"
}: UseTablePreferencesOptions<T>) {
  const defaults = useMemo<TablePreferences>(
    () => ({
      columns: makeDefaultColumns(columns),
      sort: defaultSort,
      pageSize: defaultPageSize,
      density: defaultDensity
    }),
    [columns, defaultDensity, defaultPageSize, defaultSort]
  );
  const [preferences, setPreferences, resetPreferences] = useLocalPreference<TablePreferences>(key, defaults);

  const columnSettings = useMemo(() => {
    const byKey = new Map(preferences.columns.map((column) => [column.key, column]));
    return defaults.columns.map((column) => ({ ...column, ...byKey.get(column.key) }));
  }, [defaults.columns, preferences.columns]);

  const visibleColumns = useMemo(() => {
    const byKey = new Map(columns.map((column) => [column.key, column]));
    return columnSettings
      .filter((column) => column.visible)
      .map((setting) => {
        const column = byKey.get(setting.key);
        if (!column) return null;
        return {
          ...column,
          width: setting.width ?? column.width
        };
      })
      .filter(Boolean) as TableColumn<T>[];
  }, [columnSettings, columns]);

  function setColumnSettings(nextColumns: ColumnSettingItem[]) {
    setPreferences({ ...preferences, columns: nextColumns });
  }

  function setSort(nextSort: TableSortState | null) {
    setPreferences({ ...preferences, sort: nextSort });
  }

  function setPageSize(nextPageSize: number) {
    setPreferences({ ...preferences, pageSize: nextPageSize });
  }

  function setDensity(nextDensity: TablePreferences["density"]) {
    setPreferences({ ...preferences, density: nextDensity });
  }

  return {
    preferences,
    columnSettings,
    visibleColumns,
    sort: preferences.sort,
    pageSize: preferences.pageSize,
    density: preferences.density,
    setColumnSettings,
    setSort,
    setPageSize,
    setDensity,
    resetPreferences
  };
}
