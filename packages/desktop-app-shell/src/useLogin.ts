import { useCallback, useState } from "react";
import { normalizeDesktopError, type DesktopError } from "@desktop-foundation/bridge";
import { useDesktopClient } from "./DesktopClientProvider";
import { useSession } from "./SessionProvider";
import type { DesktopLoginConfig, DesktopLoginPayload, DesktopSessionUser } from "./types";

export function useLogin<TUser extends DesktopSessionUser = DesktopSessionUser, TPayload extends DesktopLoginPayload = DesktopLoginPayload>(
  config: DesktopLoginConfig<TUser, TPayload>
) {
  const client = useDesktopClient();
  const session = useSession<TUser>();
  const [payload, setPayload] = useState<TPayload>(
    {
      account: "",
      password: "",
      remember: true,
      ...config.defaultPayload
    } as TPayload
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<DesktopError | null>(null);

  const setField = useCallback(<K extends keyof TPayload>(key: K, value: TPayload[K]) => {
    setPayload((current) => ({ ...current, [key]: value }));
  }, []);

  const submit = useCallback(
    async (override?: Partial<TPayload>) => {
      setLoading(true);
      setError(null);
      try {
        const nextPayload = { ...payload, ...override } as TPayload;
        const reply = await config.login(client, nextPayload);
        session.setAuthenticated(reply.token, reply.user ?? null, reply.remember ?? nextPayload.remember);
        client.diagnostics.recordAuditEvent({
          action: "auth.login.success",
          ok: true,
          metadata: {
            account: nextPayload.account,
            remember: reply.remember ?? nextPayload.remember,
            userId: reply.user?.id
          }
        });
        config.onSuccess?.(reply);
        return reply;
      } catch (caught) {
        const normalized = normalizeDesktopError(caught, { message: "Login failed" });
        client.diagnostics.recordAuditEvent({
          action: "auth.login.failed",
          level: "error",
          ok: false,
          message: normalized.message,
          metadata: { account: payload.account },
          error: {
            name: normalized.name,
            message: normalized.message,
            code: normalized.code,
            status: normalized.status,
            kind: normalized.kind,
            retryable: normalized.retryable,
            requestId: normalized.requestId
          }
        });
        setError(normalized);
        throw normalized;
      } finally {
        setLoading(false);
      }
    },
    [client, config, payload, session]
  );

  return {
    payload,
    setPayload,
    setField,
    submit,
    loading,
    error
  };
}
