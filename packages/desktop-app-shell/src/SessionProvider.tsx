import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { normalizeDesktopError } from "@desktop-foundation/bridge";
import { useDesktopClient } from "./DesktopClientProvider";
import type { DesktopSessionConfig, DesktopSessionState, DesktopSessionUser } from "./types";

export interface SessionContextValue<TUser extends DesktopSessionUser = DesktopSessionUser> extends DesktopSessionState<TUser> {
  refresh: () => Promise<void>;
  setAuthenticated: (token: string, user?: TUser | null, remember?: boolean) => void;
  clearSession: () => void;
}

const SessionContext = createContext<SessionContextValue<DesktopSessionUser> | null>(null);

export interface SessionProviderProps<TUser extends DesktopSessionUser = DesktopSessionUser> {
  config?: DesktopSessionConfig<TUser>;
  children: ReactNode;
}

export function SessionProvider<TUser extends DesktopSessionUser = DesktopSessionUser>({ config, children }: SessionProviderProps<TUser>) {
  const client = useDesktopClient();
  const [state, setState] = useState<DesktopSessionState<TUser>>({
    status: "checking",
    token: null,
    user: null,
    error: null
  });

  const applyState = useCallback(
    (nextState: DesktopSessionState<TUser>) => {
      setState(nextState);
      config?.onSessionChange?.(nextState);
    },
    [config]
  );

  const refresh = useCallback(async () => {
    const token = client.session.getToken();
    if (!token) {
      applyState({ status: "anonymous", token: null, user: null, error: null });
      return;
    }

    try {
      const user = config?.loadUser ? await config.loadUser(client) : null;
      applyState({ status: "authenticated", token, user, error: null });
    } catch (error) {
      const normalizedError = normalizeDesktopError(error, { message: "Failed to load session" });
      client.session.clearToken();
      applyState({ status: "anonymous", token: null, user: null, error: normalizedError });
      config?.onUnauthorized?.();
    }
  }, [applyState, client, config]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setAuthenticated = useCallback(
    (token: string, user?: TUser | null, remember?: boolean) => {
      client.session.setToken(token, remember);
      applyState({ status: "authenticated", token, user: user ?? null, error: null });
    },
    [applyState, client]
  );

  const clearSession = useCallback(() => {
    client.session.clearToken();
    applyState({ status: "anonymous", token: null, user: null, error: null });
  }, [applyState, client]);

  const value = useMemo(
    () => ({
      ...state,
      refresh,
      setAuthenticated,
      clearSession
    }),
    [clearSession, refresh, setAuthenticated, state]
  );

  return <SessionContext.Provider value={value as unknown as SessionContextValue<DesktopSessionUser>}>{children}</SessionContext.Provider>;
}

export function useSession<TUser extends DesktopSessionUser = DesktopSessionUser>() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used inside SessionProvider");
  }
  return context as unknown as SessionContextValue<TUser>;
}
