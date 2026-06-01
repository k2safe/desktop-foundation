import type { ReactNode } from "react";
import { ContentPanel } from "../layout/ContentPanel";
import { FilterBar } from "./FilterBar";
import { Pagination, type PaginationProps } from "./Pagination";
import { Table, type TableProps } from "./Table";

export interface DataTableProps<T> extends TableProps<T> {
  title?: ReactNode;
  description?: ReactNode;
  filters?: ReactNode;
  actions?: ReactNode;
  batchActions?: ReactNode | ((selectedCount: number) => ReactNode);
  selectedLabel?: (count: number) => ReactNode;
  pagination?: PaginationProps;
}

export function DataTable<T>({
  title,
  description,
  filters,
  actions,
  batchActions,
  selectedLabel = (count) => `已选择 ${count} 项`,
  pagination,
  ...tableProps
}: DataTableProps<T>) {
  const selectedCount = tableProps.selectedRowKeys?.length ?? 0;
  const resolvedBatchActions = typeof batchActions === "function" ? batchActions(selectedCount) : batchActions;

  return (
    <ContentPanel title={title} description={description} actions={actions}>
      {filters ? <FilterBar>{filters}</FilterBar> : null}
      {selectedCount > 0 && resolvedBatchActions ? (
        <div className="df-data-table__batch-bar">
          <div className="df-data-table__selected-count">{selectedLabel(selectedCount)}</div>
          <div className="df-data-table__batch-actions">{resolvedBatchActions}</div>
        </div>
      ) : null}
      <Table {...tableProps} />
      {pagination ? <Pagination {...pagination} /> : null}
    </ContentPanel>
  );
}
