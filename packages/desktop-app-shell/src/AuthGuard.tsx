import type { ReactNode } from "react";
import { useSession } from "./SessionProvider";

export interface AuthGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
  checkingFallback?: ReactNode;
}

export function AuthGuard({ children, fallback = null, checkingFallback = null }: AuthGuardProps) {
  const session = useSession();

  if (session.status === "checking") return <>{checkingFallback}</>;
  if (session.status !== "authenticated") return <>{fallback}</>;
  return <>{children}</>;
}
