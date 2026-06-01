import { Badge, type BadgeTone } from "../primitives/Badge";

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

const statusLabel: Record<string, string> = {
  active: "启用",
  enabled: "启用",
  running: "运行中",
  normal: "正常",
  online: "在线",
  success: "成功",
  succeeded: "成功",
  pending: "处理中",
  processing: "处理中",
  reviewing: "需复核",
  queued: "队列中",
  warning: "需复核",
  disabled: "停用",
  inactive: "停用",
  failed: "失败",
  error: "异常",
  danger: "失败"
};

export function StatusTag({ status, label, tone }: StatusTagProps) {
  const normalized = status.toLowerCase();
  return <Badge tone={tone ?? statusTone[normalized] ?? "neutral"}>{label ?? statusLabel[normalized] ?? status}</Badge>;
}
