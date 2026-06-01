import { Badge, type BadgeTone } from "../primitives/Badge";

export interface StatusTagProps {
  status: string;
  label?: string;
  tone?: BadgeTone;
}

const statusTone: Record<string, BadgeTone> = {
  active: "success",
  enabled: "success",
  online: "success",
  success: "success",
  pending: "warning",
  processing: "warning",
  warning: "warning",
  disabled: "neutral",
  inactive: "neutral",
  failed: "danger",
  error: "danger",
  danger: "danger"
};

export function StatusTag({ status, label, tone }: StatusTagProps) {
  return <Badge tone={tone ?? statusTone[status.toLowerCase()] ?? "neutral"}>{label ?? status}</Badge>;
}
