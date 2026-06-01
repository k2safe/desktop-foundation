import type { ReactNode } from "react";
import { useSession } from "./SessionProvider";

export interface PermissionGuardProps {
  permission?: string;
  permissions?: string[];
  mode?: "any" | "all";
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGuard({ permission, permissions, mode = "all", children, fallback = null }: PermissionGuardProps) {
  const session = useSession();
  const required = permissions ?? (permission ? [permission] : []);
  const owned = new Set(session.user?.permissions ?? []);
  const allowed = required.length === 0 || (mode === "all" ? required.every((item) => owned.has(item)) : required.some((item) => owned.has(item)));

  return <>{allowed ? children : fallback}</>;
}

export interface FeatureGuardProps {
  enabled?: boolean;
  children: ReactNode;
  fallback?: ReactNode;
}

export function FeatureGuard({ enabled, children, fallback = null }: FeatureGuardProps) {
  return <>{enabled ? children : fallback}</>;
}
