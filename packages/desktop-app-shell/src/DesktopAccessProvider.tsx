import type { ReactNode } from "react";
import { AccessProvider, type AccessControlConfig } from "@desktop-foundation/ui-react";
import { useSession } from "./SessionProvider";
import type { DesktopSessionUser } from "./types";

export interface DesktopAccessProviderProps {
  accessControl?: AccessControlConfig;
  children: ReactNode;
}

function unique(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}

function getUserRoles(user: DesktopSessionUser | null) {
  return unique([user?.role, ...(user?.roles ?? [])]);
}

export function DesktopAccessProvider({ accessControl, children }: DesktopAccessProviderProps) {
  const session = useSession();
  const permissions = unique([...(session.user?.permissions ?? []), ...(accessControl?.permissions ?? [])]);
  const roles = unique([...getUserRoles(session.user), ...(accessControl?.roles ?? [])]);

  return (
    <AccessProvider permissions={permissions} roles={roles} features={accessControl?.features}>
      {children}
    </AccessProvider>
  );
}
