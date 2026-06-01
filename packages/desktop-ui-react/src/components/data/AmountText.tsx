import { cn } from "../../utils/cn";

export interface AmountTextProps {
  value: string | number;
  currency?: string;
  sign?: "auto" | "never";
  tone?: "default" | "success" | "danger" | "muted";
  className?: string;
}

export function AmountText({ value, currency, sign = "auto", tone = "default", className }: AmountTextProps) {
  const numeric = typeof value === "number" ? value : Number(value);
  const resolvedTone = tone === "default" && Number.isFinite(numeric) && numeric < 0 ? "danger" : tone;
  const prefix = sign === "auto" && Number.isFinite(numeric) && numeric > 0 ? "+" : "";

  return (
    <span className={cn("df-amount", `df-amount--${resolvedTone}`, className)}>
      {prefix}
      {value}
      {currency ? <span className="df-amount__currency">{currency}</span> : null}
    </span>
  );
}
