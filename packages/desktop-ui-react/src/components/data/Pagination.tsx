import { Button } from "../primitives/Button";

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  previousLabel?: string;
  nextLabel?: string;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, previousLabel = "上一页", nextLabel = "下一页", onPageChange }: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  return (
    <div className="df-pagination">
      <div className="df-pagination__summary">
        {start}-{end} / {total}
      </div>
      <div className="df-pagination__actions">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          {previousLabel}
        </Button>
        <span className="df-pagination__page">
          {page} / {pageCount}
        </span>
        <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}
