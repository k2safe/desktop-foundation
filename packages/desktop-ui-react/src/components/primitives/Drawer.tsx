import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface DrawerProps {
  open: boolean;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  side?: "left" | "right";
  className?: string;
  closeLabel?: string;
  onClose: () => void;
}

export function Drawer({ open, title, children, footer, side = "right", className, closeLabel = "关闭", onClose }: DrawerProps) {
  if (!open) return null;

  return (
    <div className="df-overlay" role="presentation">
      <aside className={cn("df-drawer", `df-drawer--${side}`, className)} role="dialog" aria-modal="true">
        <div className="df-drawer__header">
          {title ? <h2 className="df-drawer__title">{title}</h2> : null}
          <button className="df-close-button" type="button" onClick={onClose} aria-label={closeLabel}>
            ×
          </button>
        </div>
        <div className="df-drawer__body">{children}</div>
        {footer ? <div className="df-drawer__footer">{footer}</div> : null}
      </aside>
    </div>
  );
}
