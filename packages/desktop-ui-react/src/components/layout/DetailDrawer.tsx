import type { ReactNode } from "react";
import { Drawer } from "../primitives/Drawer";
import { Button, type ButtonProps } from "../primitives/Button";

export interface DetailDrawerRow {
  label: ReactNode;
  value: ReactNode;
}

export interface DetailDrawerAction {
  id: string;
  label: ReactNode;
  variant?: ButtonProps["variant"];
  disabled?: boolean;
  onClick: () => void;
}

export interface DetailDrawerProps {
  open: boolean;
  title: ReactNode;
  subtitle?: ReactNode;
  rows?: DetailDrawerRow[];
  children?: ReactNode;
  actions?: DetailDrawerAction[];
  closeLabel?: string;
  onClose: () => void;
}

export function DetailDrawer({ open, title, subtitle, rows = [], children, actions = [], closeLabel, onClose }: DetailDrawerProps) {
  return (
    <Drawer
      open={open}
      title={
        <span className="df-detail-drawer__heading">
          <span>{title}</span>
          {subtitle ? <span className="df-detail-drawer__subtitle">{subtitle}</span> : null}
        </span>
      }
      footer={
        actions.length ? (
          <div className="df-detail-drawer__actions">
            {actions.map((action) => (
              <Button key={action.id} size="sm" variant={action.variant ?? "outline"} disabled={action.disabled} onClick={action.onClick}>
                {action.label}
              </Button>
            ))}
          </div>
        ) : null
      }
      closeLabel={closeLabel}
      onClose={onClose}
    >
      {rows.length ? (
        <dl className="df-detail-drawer__list">
          {rows.map((row, index) => (
            <div className="df-detail-drawer__row" key={index}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {children}
    </Drawer>
  );
}
