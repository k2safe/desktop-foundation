import { Badge, type BadgeTone } from "../primitives/Badge";
import { useLocale } from "../../locale";

export interface StatusTagProps {
  status: string;
  label?: string;
  tone?: BadgeTone;
}

const statusTone: Record<string, BadgeTone> = {
  active: "success",
  enabled: "success",
  running: "success",
  normal: "success",
  online: "success",
  success: "success",
  succeeded: "success",
  pending: "warning",
  processing: "warning",
  reviewing: "warning",
  queued: "warning",
  warning: "warning",
  disabled: "neutral",
  inactive: "neutral",
  failed: "danger",
  error: "danger",
  danger: "danger"
};

export function StatusTag({ status, label, tone }: StatusTagProps) {
  const { t } = useLocale();
  const normalized = status.toLowerCase();
  return <Badge tone={tone ?? statusTone[normalized] ?? "neutral"}>{label ?? t(`status.${normalized}`, undefined, status)}</Badge>;
}
