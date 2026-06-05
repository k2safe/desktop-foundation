import type { CSSProperties, ReactNode } from "react";
import { useLocale } from "../../locale";
import { cn } from "../../utils/cn";

export interface DrawerProps {
  open: boolean;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  side?: "left" | "right";
  className?: string;
  style?: CSSProperties;
  closeLabel?: string;
  onClose: () => void;
}

export function Drawer({ open, title, children, footer, side = "right", className, style, closeLabel, onClose }: DrawerProps) {
  const { t } = useLocale();
  if (!open) return null;

  return (
    <div className="df-overlay" role="presentation">
      <aside className={cn("df-drawer", `df-drawer--${side}`, className)} style={style} role="dialog" aria-modal="true">
        <div className="df-drawer__header">
          {title ? <h2 className="df-drawer__title">{title}</h2> : null}
          <button className="df-close-button" type="button" onClick={onClose} aria-label={closeLabel ?? t("common.close")}>
            ×
          </button>
        </div>
        <div className="df-drawer__body">{children}</div>
        {footer ? <div className="df-drawer__footer">{footer}</div> : null}
      </aside>
    </div>
  );
}
