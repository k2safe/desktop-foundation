import type { ReactNode } from "react";
import { cn } from "../../utils/cn";
import { Button, type ButtonProps } from "../primitives/Button";

export interface BulkActionItem {
  id: string;
  label: ReactNode;
  variant?: ButtonProps["variant"];
  disabled?: boolean;
  onClick: () => void;
}

export interface BulkActionBarProps {
  selectedCount: number;
  actions: BulkActionItem[];
  label?: (count: number) => ReactNode;
  clearLabel?: ReactNode;
  className?: string;
  onClear?: () => void;
}

export function BulkActionBar({ selectedCount, actions, label, clearLabel = "Clear", className, onClear }: BulkActionBarProps) {
  if (selectedCount <= 0) return null;

  return (
    <div className={cn("df-bulk-action-bar", className)}>
      <div className="df-bulk-action-bar__label">{label ? label(selectedCount) : `${selectedCount} selected`}</div>
      <div className="df-bulk-action-bar__actions">
        {actions.map((action) => (
          <Button key={action.id} size="sm" variant={action.variant ?? "outline"} disabled={action.disabled} onClick={action.onClick}>
            {action.label}
          </Button>
        ))}
        {onClear ? (
          <Button size="sm" variant="ghost" onClick={onClear}>
            {clearLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
