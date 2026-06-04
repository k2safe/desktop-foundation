import { useEffect, useMemo, useState } from "react";
import { Badge, Button, CodeBlock, Drawer, Tabs, useLocale, type TabItem } from "@desktop-foundation/ui-react";
import { useDesktopClient } from "./DesktopClientProvider";
import { useSession } from "./SessionProvider";

export interface DebugPanelProps {
  open: boolean;
  appVersion?: string;
  environment?: string;
  onClose: () => void;
}

function maskToken(token: string | null) {
  if (!token) return null;
  if (token.length <= 12) return "******";
  return `${token.slice(0, 6)}...${token.slice(-6)}`;
}

export function DebugPanel({ open, appVersion, environment, onClose }: DebugPanelProps) {
  const { t } = useLocale();
  const client = useDesktopClient();
  const session = useSession();
  const [tab, setTab] = useState("requests");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [open]);

  const tabs: TabItem[] = useMemo(
    () => [
      { value: "requests", label: t("debug.requests") },
      { value: "audit", label: t("debug.audit") },
      { value: "session", label: t("debug.session") },
      { value: "runtime", label: t("debug.runtime") }
    ],
    [t]
  );
  const requests = useMemo(() => client.diagnostics.getRecentRequests(), [client, tick]);
  const auditEvents = useMemo(() => client.diagnostics.getRecentAuditEvents(), [client, tick]);
  const clearCurrentTab = () => {
    if (tab === "audit") {
      client.diagnostics.clearRecentAuditEvents();
    } else {
      client.diagnostics.clearRecentRequests();
    }
    setTick((value) => value + 1);
  };

  return (
    <Drawer
      open={open}
      title={t("debug.title")}
      onClose={onClose}
      footer={
        <Button variant="outline" onClick={clearCurrentTab}>
          {tab === "audit" ? t("debug.clearAudit") : t("debug.clearRequests")}
        </Button>
      }
    >
      <div className="df-debug-panel">
        <Tabs items={tabs} value={tab} onValueChange={setTab} />
        {tab === "requests" ? (
          <div className="df-debug-panel__list">
            {requests.length ? (
              requests.map((request) => (
                <div key={request.id} className="df-debug-panel__request">
                  <div className="df-debug-panel__request-head">
                    <Badge tone={request.ok === false ? "danger" : request.ok ? "success" : "neutral"}>{request.method}</Badge>
                    <span>{request.durationMs ?? 0}ms</span>
                  </div>
                  <code>{request.url}</code>
                  {request.error ? <p>{request.error.message}</p> : null}
                </div>
              ))
            ) : (
              <CodeBlock>{t("debug.noRequests")}</CodeBlock>
            )}
          </div>
        ) : null}
        {tab === "audit" ? (
          <div className="df-debug-panel__list">
            {auditEvents.length ? (
              auditEvents.map((event) => (
                <div key={event.id} className="df-debug-panel__request">
                  <div className="df-debug-panel__request-head">
                    <Badge tone={event.level === "error" ? "danger" : event.level === "warn" ? "warning" : event.ok ? "success" : "neutral"}>{event.level}</Badge>
                    <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <code>{event.action}</code>
                  {event.target ? <p>{event.target}</p> : null}
                  {event.message ? <p>{event.message}</p> : null}
                </div>
              ))
            ) : (
              <CodeBlock>{t("debug.noAuditEvents")}</CodeBlock>
            )}
          </div>
        ) : null}
        {tab === "session" ? (
          <CodeBlock>
            {JSON.stringify(
              {
                status: session.status,
                token: maskToken(session.token),
                user: session.user,
                error: session.error?.message
              },
              null,
              2
            )}
          </CodeBlock>
        ) : null}
        {tab === "runtime" ? (
          <CodeBlock>
            {JSON.stringify(
              {
                appVersion,
                environment,
                userAgent: typeof navigator !== "undefined" ? navigator.userAgent : t("debug.unknown"),
                time: new Date().toISOString()
              },
              null,
              2
            )}
          </CodeBlock>
        ) : null}
      </div>
    </Drawer>
  );
}
