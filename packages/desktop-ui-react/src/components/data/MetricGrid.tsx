import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface MetricItem {
  id: string;
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  trend?: ReactNode;
}

export interface MetricGridProps {
  metrics: MetricItem[];
  columns?: 2 | 3 | 4;
  className?: string;
}

export function MetricGrid({ metrics, columns = 4, className }: MetricGridProps) {
  return (
    <div className={cn("df-metric-grid", `df-metric-grid--${columns}`, className)}>
      {metrics.map((metric) => (
        <section className="df-metric" key={metric.id}>
          <div className="df-metric__label">{metric.label}</div>
          <div className="df-metric__value">{metric.value}</div>
          <div className="df-metric__footer">
            {metric.hint ? <span>{metric.hint}</span> : null}
            {metric.trend ? <span className="df-metric__trend">{metric.trend}</span> : null}
          </div>
        </section>
      ))}
    </div>
  );
}
