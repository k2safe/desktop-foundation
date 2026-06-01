import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface TabItem {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}

export function Tabs({ items, value, onValueChange, className }: TabsProps) {
  return (
    <div className={cn("df-tabs", className)} role="tablist">
      {items.map((item) => (
        <button
          key={item.value}
          className={cn("df-tab", item.value === value && "is-active")}
          type="button"
          role="tab"
          aria-selected={item.value === value}
          disabled={item.disabled}
          onClick={() => onValueChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
