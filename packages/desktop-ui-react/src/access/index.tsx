import { createContext, useContext, useMemo, type ReactNode } from "react";

export type AccessMatchMode = "all" | "any";
export type AccessFeatureFlags = readonly string[] | Record<string, boolean | undefined>;

export interface AccessRule {
  permission?: string;
  permissions?: readonly string[];
  permissionMode?: AccessMatchMode;
  role?: string;
  roles?: readonly string[];
  roleMode?: AccessMatchMode;
  feature?: string;
  features?: readonly string[];
  featureMode?: AccessMatchMode;
}

export interface AccessControlled {
  access?: AccessRule;
  permission?: string;
  permissions?: readonly string[];
  permissionMode?: AccessMatchMode;
  role?: string;
  roles?: readonly string[];
  roleMode?: AccessMatchMode;
  feature?: string;
  features?: readonly string[];
  featureMode?: AccessMatchMode;
}

export interface AccessControlConfig {
  permissions?: readonly string[];
  roles?: readonly string[];
  features?: AccessFeatureFlags;
}

export interface AccessContextValue extends Required<AccessControlConfig> {
  canAccess: (rule?: AccessRule | AccessControlled | null) => boolean;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
  isFeatureEnabled: (feature: string) => boolean;
}

export interface AccessProviderProps extends AccessControlConfig {
  children: ReactNode;
}

function unique(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}

function normalizeFeatures(features?: AccessFeatureFlags): Record<string, boolean> {
  if (!features) return {};
  if (Array.isArray(features)) {
    return Object.fromEntries(features.map((feature) => [feature, true]));
  }
  return Object.fromEntries(Object.entries(features).filter(([, enabled]) => enabled));
}

function mergeValues(single?: string, many?: readonly string[], accessSingle?: string, accessMany?: readonly string[]) {
  return unique([accessSingle, ...(accessMany ?? []), single, ...(many ?? [])]);
}

export function createAccessRule(source?: AccessRule | AccessControlled | null): AccessRule | undefined {
  if (!source) return undefined;
  const controlled = source as AccessControlled;
  const access = controlled.access ?? {};

  return {
    permissions: mergeValues(controlled.permission, controlled.permissions, access.permission, access.permissions),
    permissionMode: controlled.permissionMode ?? access.permissionMode,
    roles: mergeValues(controlled.role, controlled.roles, access.role, access.roles),
    roleMode: controlled.roleMode ?? access.roleMode,
    features: mergeValues(controlled.feature, controlled.features, access.feature, access.features),
    featureMode: controlled.featureMode ?? access.featureMode
  };
}

function matches(values: readonly string[], owned: readonly string[], mode: AccessMatchMode = "all") {
  if (!values.length) return true;
  const ownedSet = new Set(owned);
  return mode === "all" ? values.every((value) => ownedSet.has(value)) : values.some((value) => ownedSet.has(value));
}

function matchesFeatures(values: readonly string[], features: Record<string, boolean>, mode: AccessMatchMode = "all") {
  if (!values.length) return true;
  return mode === "all" ? values.every((value) => Boolean(features[value])) : values.some((value) => Boolean(features[value]));
}

export function evaluateAccess(config: AccessControlConfig, rule?: AccessRule | AccessControlled | null) {
  const normalizedRule = createAccessRule(rule);
  if (!normalizedRule) return true;

  const permissions = config.permissions ?? [];
  const roles = config.roles ?? [];
  const features = normalizeFeatures(config.features);

  return (
    matches(normalizedRule.permissions ?? [], permissions, normalizedRule.permissionMode) &&
    matches(normalizedRule.roles ?? [], roles, normalizedRule.roleMode) &&
    matchesFeatures(normalizedRule.features ?? [], features, normalizedRule.featureMode)
  );
}

function createAccessContextValue(config: AccessControlConfig): AccessContextValue {
  const permissions = unique([...(config.permissions ?? [])]);
  const roles = unique([...(config.roles ?? [])]);
  const features = normalizeFeatures(config.features);

  return {
    permissions,
    roles,
    features,
    canAccess: (rule) => evaluateAccess({ permissions, roles, features }, rule),
    hasPermission: (permission) => permissions.includes(permission),
    hasRole: (role) => roles.includes(role),
    isFeatureEnabled: (feature) => Boolean(features[feature])
  };
}

const defaultAccessContext = createAccessContextValue({});
const AccessContext = createContext<AccessContextValue>(defaultAccessContext);

export function AccessProvider({ permissions, roles, features, children }: AccessProviderProps) {
  const value = useMemo(() => createAccessContextValue({ permissions, roles, features }), [features, permissions, roles]);
  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess() {
  return useContext(AccessContext);
}
