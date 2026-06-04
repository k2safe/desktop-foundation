import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { createAccessRule, ErrorState, useAccess, useLocale, type AccessMatchMode, type AccessRule } from "@desktop-foundation/ui-react";
import { useDesktopClient } from "./DesktopClientProvider";

export interface AccessGuardProps extends AccessRule {
  access?: AccessRule;
  children: ReactNode;
  fallback?: ReactNode;
}

export interface AccessDeniedStateProps {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function AccessDeniedState({ title, description, action, className }: AccessDeniedStateProps) {
  const { t } = useLocale();
  return (
    <ErrorState
      title={title ?? t("access.deniedTitle")}
      description={description ?? t("access.deniedDescription")}
      action={action}
      className={className}
    />
  );
}

export function AccessGuard({ access, children, fallback = null, ...rule }: AccessGuardProps) {
  const client = useDesktopClient();
  const { canAccess } = useAccess();
  const accessRule = useMemo(
    () => ({ access, ...rule }),
    [access, rule.feature, rule.featureMode, rule.features, rule.permission, rule.permissionMode, rule.permissions, rule.role, rule.roleMode, rule.roles]
  );
  const normalizedRule = useMemo(() => createAccessRule(accessRule), [accessRule]);
  const auditKey = useMemo(() => JSON.stringify(normalizedRule ?? {}), [normalizedRule]);
  const lastDeniedAuditKey = useRef<string | null>(null);
  const allowed = canAccess(accessRule);

  useEffect(() => {
    if (allowed) {
      lastDeniedAuditKey.current = null;
      return;
    }
    if (lastDeniedAuditKey.current === auditKey) return;
    lastDeniedAuditKey.current = auditKey;
    client.diagnostics.recordAuditEvent({
      action: "access.denied",
      level: "warn",
      ok: false,
      metadata: {
        features: normalizedRule?.features,
        featureMode: normalizedRule?.featureMode,
        permissions: normalizedRule?.permissions,
        permissionMode: normalizedRule?.permissionMode,
        roles: normalizedRule?.roles,
        roleMode: normalizedRule?.roleMode
      }
    });
  }, [allowed, auditKey, client, normalizedRule]);

  return <>{allowed ? children : fallback}</>;
}

export interface PermissionGuardProps {
  permission?: string;
  permissions?: string[];
  mode?: AccessMatchMode;
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGuard({ permission, permissions, mode = "all", children, fallback = null }: PermissionGuardProps) {
  return (
    <AccessGuard permission={permission} permissions={permissions} permissionMode={mode} fallback={fallback}>
      {children}
    </AccessGuard>
  );
}

export interface FeatureGuardProps {
  enabled?: boolean;
  feature?: string;
  features?: string[];
  mode?: AccessMatchMode;
  children: ReactNode;
  fallback?: ReactNode;
}

export function FeatureGuard({ enabled, feature, features, mode = "all", children, fallback = null }: FeatureGuardProps) {
  const hasNamedFeatureRule = Boolean(feature || features?.length);

  if (enabled === false) return <>{fallback}</>;
  if (!hasNamedFeatureRule) return <>{enabled ? children : fallback}</>;

  return (
    <AccessGuard feature={feature} features={features} featureMode={mode} fallback={fallback}>
      {children}
    </AccessGuard>
  );
}
