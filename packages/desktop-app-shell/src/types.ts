import type { DesktopClient, DesktopClientConfig } from "@desktop-foundation/bridge";
import type { DesktopThemeInput } from "@desktop-foundation/ui-react";
import type { ReactNode } from "react";

export type SessionStatus = "checking" | "authenticated" | "anonymous";

export interface DesktopSessionUser {
  id?: string;
  name?: string;
  account?: string;
  email?: string;
  role?: string;
  permissions?: string[];
  raw?: unknown;
}

export interface DesktopLoginPayload {
  account: string;
  password: string;
  remember?: boolean;
  [key: string]: unknown;
}

export interface DesktopLoginReply<TUser extends DesktopSessionUser = DesktopSessionUser> {
  token: string;
  user?: TUser | null;
  remember?: boolean;
}

export interface DesktopLoginConfig<
  TUser extends DesktopSessionUser = DesktopSessionUser,
  TPayload extends DesktopLoginPayload = DesktopLoginPayload
> {
  login: (client: DesktopClient, payload: TPayload) => Promise<DesktopLoginReply<TUser>>;
  defaultPayload?: Partial<TPayload>;
  onSuccess?: (reply: DesktopLoginReply<TUser>) => void;
}

export interface DesktopSessionState<TUser extends DesktopSessionUser = DesktopSessionUser> {
  status: SessionStatus;
  token: string | null;
  user: TUser | null;
  error: Error | null;
}

export interface DesktopSessionConfig<TUser extends DesktopSessionUser = DesktopSessionUser> {
  loadUser?: (client: DesktopClient) => Promise<TUser | null>;
  onUnauthorized?: () => void;
  onSessionChange?: (state: DesktopSessionState<TUser>) => void;
}

export interface DesktopAppShellProps<TUser extends DesktopSessionUser = DesktopSessionUser> {
  theme?: DesktopThemeInput;
  className?: string;
  client: DesktopClientConfig | DesktopClient;
  session?: DesktopSessionConfig<TUser>;
  children: ReactNode;
}
