import { cn } from "../../utils/cn";

export interface LoadingBlockProps {
  rows?: number;
  className?: string;
  label?: string;
}

export function LoadingBlock({ rows = 3, className, label = "加载中" }: LoadingBlockProps) {
  return (
    <div className={cn("df-loading-block", className)} aria-label={label} role="status">
      {Array.from({ length: rows }).map((_, index) => (
        <span key={index} className="df-loading-block__row" />
      ))}
    </div>
  );
}
