import { cn } from "../../utils/cn";

export interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  tone?: "primary" | "success" | "warning" | "danger";
  className?: string;
}

export function ProgressBar({ value, max = 100, label, tone = "primary", className }: ProgressBarProps) {
  const percent = Math.max(0, Math.min(100, (value / max) * 100));

  return (
    <div className={cn("df-progress", className)} aria-label={label} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <span className={cn("df-progress__bar", `df-progress__bar--${tone}`)} style={{ width: `${percent}%` }} />
    </div>
  );
}
