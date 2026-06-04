import { useLocale } from "../../locale";
import { cn } from "../../utils/cn";

export interface LoadingBlockProps {
  rows?: number;
  className?: string;
  label?: string;
}

export function LoadingBlock({ rows = 3, className, label }: LoadingBlockProps) {
  const { t } = useLocale();

  return (
    <div className={cn("df-loading-block", className)} aria-label={label ?? t("common.loading")} role="status">
      {Array.from({ length: rows }).map((_, index) => (
        <span key={index} className="df-loading-block__row" />
      ))}
    </div>
  );
}
