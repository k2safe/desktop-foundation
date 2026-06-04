import type { ReactNode } from "react";
import { useLocale } from "../../locale";
import { cn } from "../../utils/cn";

export interface OfflineBannerProps {
  visible?: boolean;
  message?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function OfflineBanner({ visible = true, message, action, className }: OfflineBannerProps) {
  const { t } = useLocale();
  if (!visible) return null;

  return (
    <div className={cn("df-offline-banner", className)} role="status">
      <span>{message ?? t("offline.message")}</span>
      {action ? <span className="df-offline-banner__action">{action}</span> : null}
    </div>
  );
}
