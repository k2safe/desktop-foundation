import { useLocale } from "../../locale";
import { Button } from "../primitives/Button";

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  previousLabel?: string;
  nextLabel?: string;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, previousLabel, nextLabel, onPageChange }: PaginationProps) {
  const { t } = useLocale();
  const resolvedPreviousLabel = previousLabel ?? t("pagination.previous");
  const resolvedNextLabel = nextLabel ?? t("pagination.next");
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
          {resolvedPreviousLabel}
        </Button>
        <span className="df-pagination__page">
          {page} / {pageCount}
        </span>
        <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
          {resolvedNextLabel}
        </Button>
      </div>
    </div>
  );
}
