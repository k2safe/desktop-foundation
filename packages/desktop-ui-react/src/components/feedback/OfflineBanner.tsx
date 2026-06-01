import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface OfflineBannerProps {
  visible?: boolean;
  message?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function OfflineBanner({ visible = true, message = "当前网络不可用", action, className }: OfflineBannerProps) {
  if (!visible) return null;

  return (
    <div className={cn("df-offline-banner", className)} role="status">
      <span>{message}</span>
      {action ? <span className="df-offline-banner__action">{action}</span> : null}
    </div>
  );
}
