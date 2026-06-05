import { useMemo, useState } from "react";
import { AdminMetricCard, AdminPageShell, Badge, Button, CodeBlock, ContentPanel, EditableTable, SettingsPage, type EditableTableColumn } from "@desktop-foundation/ui-react";
import { UpdateCenterPanel } from "@desktop-foundation/app-shell";
import type { DesktopClient, HttpResponseMeta } from "@desktop-foundation/bridge";

interface RuntimeFlag {
  id: string;
  name: string;
  value: string;
  scope: string;
}

type SmokeStatus = "idle" | "running" | "passed" | "failed";

interface SmokeResult {
  status: SmokeStatus;
  message: string;
  durationMs?: number;
  detail?: unknown;
}

interface FoundationSmokeCheck {
  id: string;
  group: string;
  name: string;
  command: string;
  description: string;
  run: () => Promise<unknown>;
}

interface MultipartSmokeReply {
  ok?: boolean;
  bodyKind?: string;
  fields?: number;
  files?: number;
  bytes?: number;
  requestId?: string;
}

const columns: EditableTableColumn<RuntimeFlag>[] = [
  { key: "name", header: "配置项", accessor: "name", readOnly: true, minWidth: 180 },
  { key: "value", header: "值", accessor: "value" },
  {
    key: "scope",
    header: "范围",
    accessor: "scope",
    type: "select",
    options: [
      { value: "app", label: "app" },
      { value: "user", label: "user" },
      { value: "secure", label: "secure" }
    ],
    width: 160
  }
];

export interface SettingsProps {
  client: DesktopClient;
  logs: string[];
}

function createMultipartBody() {
  const form = new FormData();
  form.append("purpose", "foundation-selfcheck");
  form.append("release", "0.1.35");
  form.append("package", new Blob(["demo update zip bytes"], { type: "application/zip" }), "product-demo-0.1.1-macos.zip");
  return form;
}

function statusTone(status: SmokeStatus) {
  if (status === "passed") return "success" as const;
  if (status === "failed") return "danger" as const;
  if (status === "running") return "info" as const;
  return "neutral" as const;
}

function statusLabel(status: SmokeStatus) {
  if (status === "passed") return "通过";
  if (status === "failed") return "失败";
  if (status === "running") return "运行中";
  return "待验收";
}

function shortJson(value: unknown) {
  if (value === undefined) return "暂无输出。";
  return JSON.stringify(value, null, 2);
}

function formatDuration(value?: number) {
  if (typeof value !== "number") return "-";
  return `${Math.max(1, Math.round(value))}ms`;
}

function LinkProxyPanel({ client }: { client: DesktopClient }) {
  const [result, setResult] = useState("等待代理请求。");

  async function runProxyRequest() {
    setResult("请求中...");
    try {
      const reply = await client.linkProxy.request("https://vendor.example.com/status", {
        method: "GET",
        query: { source: "desktop-demo" }
      });
      setResult(JSON.stringify(reply, null, 2));
    } catch (error) {
      setResult(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <div className="demo-settings-stack">
      <div className="demo-smoke-actions">
        <Button size="sm" onClick={() => void runProxyRequest()}>
          请求链接
        </Button>
      </div>
      <CodeBlock>{result}</CodeBlock>
    </div>
  );
}

function SmokePanel({
  checks,
  results,
  runningId,
  onRun,
  onRunAll
}: {
  checks: FoundationSmokeCheck[];
  results: Record<string, SmokeResult>;
  runningId: string | null;
  onRun: (check: FoundationSmokeCheck) => Promise<void>;
  onRunAll: () => Promise<void>;
}) {
  const activeResult = [...checks].reverse().map((check) => results[check.id]).find((result) => result?.detail || result?.message);
  const running = Boolean(runningId);

  return (
    <ContentPanel
      className="demo-smoke-panel"
      title="底座能力验收"
      description="每一项都从 Product Demo 走 DesktopClient，桌面端会继续穿过 Tauri command 和 desktop-core-rs。"
      actions={
        <Button size="sm" loading={running} onClick={() => void onRunAll()}>
          一键自检
        </Button>
      }
    >
      <div className="demo-smoke-grid">
        {checks.map((check) => {
          const result = results[check.id] ?? { status: "idle" as const, message: check.description };
          return (
            <section className={`demo-smoke-card is-${result.status}`} key={check.id}>
              <div className="demo-smoke-card__header">
                <span>{check.group}</span>
                <Badge tone={statusTone(result.status)}>{statusLabel(result.status)}</Badge>
              </div>
              <strong>{check.name}</strong>
              <p>{result.message || check.description}</p>
              <div className="demo-smoke-card__meta">
                <span>{check.command}</span>
                <span>{formatDuration(result.durationMs)}</span>
              </div>
              <Button variant="outline" size="sm" loading={runningId === check.id} onClick={() => void onRun(check)}>
                运行
              </Button>
            </section>
          );
        })}
      </div>
      <div className="demo-smoke-output">
        <div>
          <span>最近输出</span>
          <strong>{activeResult?.status ? statusLabel(activeResult.status) : "待验收"}</strong>
        </div>
        <CodeBlock>{shortJson(activeResult?.detail ?? activeResult?.message)}</CodeBlock>
      </div>
    </ContentPanel>
  );
}

export function Settings({ client, logs }: SettingsProps) {
  const [activeSectionId, setActiveSectionId] = useState("overview");
  const [runningSmokeId, setRunningSmokeId] = useState<string | null>(null);
  const [smokeResults, setSmokeResults] = useState<Record<string, SmokeResult>>({});
  const [flags, setFlags] = useState<RuntimeFlag[]>([
    { id: "api", name: "apiBaseURL", value: "http://127.0.0.1:3000", scope: "app" },
    { id: "manifest", name: "updateManifest", value: "/update/latest.json", scope: "app" },
    { id: "token", name: "refreshToken", value: "secure-storage", scope: "secure" },
    { id: "density", name: "tableDensity", value: "default", scope: "user" }
  ]);
  const recentRequests = client.diagnostics.getRecentRequests();
  const auditEvents = client.diagnostics.getRecentAuditEvents();
  const updateState = client.updates.getState();

  const smokeChecks = useMemo<FoundationSmokeCheck[]>(
    () => [
      {
        id: "http-cache",
        group: "HTTP",
        name: "Rust HTTP cache",
        command: "client.http.get(cache)",
        description: "连续请求语言配置，第二次必须从底座缓存返回。",
        run: async () => {
          const cacheKey = `demo-product:selfcheck:languages:${Date.now()}`;
          let firstMeta: HttpResponseMeta | undefined;
          let secondMeta: HttpResponseMeta | undefined;
          const options = {
            auth: false,
            cache: { key: cacheKey, ttlMs: 60_000, storage: "persistent" as const, staleIfError: true },
            namespace: "foundation-selfcheck"
          };
          const first = await client.http.get("/demo-api/languages.json", {
            ...options,
            requestId: "selfcheck-http-cache-first",
            onResponse: (meta) => {
              firstMeta = meta;
            }
          });
          const second = await client.http.get("/demo-api/languages.json", {
            ...options,
            requestId: "selfcheck-http-cache-second",
            onResponse: (meta) => {
              secondMeta = meta;
            }
          });
          if (secondMeta?.cache && !secondMeta.cache.hit) {
            throw new Error("第二次请求没有命中 HTTP cache。");
          }
          return { first, second, firstCache: firstMeta?.cache, secondCache: secondMeta?.cache };
        }
      },
      {
        id: "multipart",
        group: "Upload",
        name: "Multipart upload",
        command: "client.http.post(FormData)",
        description: "浏览器 FormData 通过 bridge 进入 Rust multipart request。",
        run: async () => {
          const reply = await client.http.post<MultipartSmokeReply>("/capabilities/upload", createMultipartBody(), {
            auth: false,
            requestId: "selfcheck-multipart",
            namespace: "foundation-selfcheck"
          });
          if (reply.ok === false) throw new Error("Multipart endpoint returned ok=false.");
          return reply;
        }
      },
      {
        id: "updates",
        group: "Update",
        name: "Update boundary",
        command: "check/download/install",
        description: "读取本地 manifest、校验 zip，并进入统一 installUpdate 边界。",
        run: async () => {
          const check = await client.updates.checkForUpdate();
          if (!check.update) return { check, state: client.updates.getState() };
          const downloaded = await client.updates.downloadUpdate(check.update, {
            directory: "/tmp",
            requestId: "selfcheck-update-download",
            namespace: "foundation-selfcheck"
          });
          const installed = await client.updates.installUpdate(check.update);
          return { check, downloaded, installed, state: client.updates.getState() };
        }
      },
      {
        id: "session-storage",
        group: "Storage",
        name: "Session / storage",
        command: "session + storage + secure",
        description: "验证 token、用户偏好和 secure storage 都从底座 client 进出。",
        run: async () => {
          client.session.setToken("selfcheck-token", true);
          client.storage.set("selfcheck.locale", "zh-CN");
          await client.secureStorage.set("selfcheck.secret", { ok: true, at: Date.now() });
          const secret = await client.secureStorage.get("selfcheck.secret");
          return {
            token: client.session.getToken(),
            locale: client.storage.get("selfcheck.locale"),
            secureStorage: secret
          };
        }
      },
      {
        id: "desktop-diagnostics",
        group: "Desktop",
        name: "Notify / diagnostics",
        command: "notify + audit",
        description: "触发桌面通知和审计日志，确认 DebugPanel 可读取诊断缓冲区。",
        run: async () => {
          await client.desktop.notify({ title: "Foundation self-check", body: "Desktop capability is ready." });
          const windowState = await client.desktop.getWindowState();
          client.diagnostics.recordAuditEvent({
            action: "foundation.selfcheck",
            ok: true,
            level: "info",
            message: "Manual foundation smoke completed"
          });
          return {
            windowState,
            requests: client.diagnostics.getRecentRequests().length,
            audits: client.diagnostics.getRecentAuditEvents().length
          };
        }
      }
    ],
    [client]
  );

  const smokeCounts = smokeChecks.reduce(
    (acc, check) => {
      const status = smokeResults[check.id]?.status ?? "idle";
      acc[status] += 1;
      return acc;
    },
    { idle: 0, running: 0, passed: 0, failed: 0 } as Record<SmokeStatus, number>
  );
  const completedChecks = smokeCounts.passed + smokeCounts.failed;
  const score = completedChecks ? Math.round((smokeCounts.passed / completedChecks) * 100) : 0;

  async function runSmoke(check: FoundationSmokeCheck) {
    const startedAt = performance.now();
    setRunningSmokeId(check.id);
    setSmokeResults((current) => ({
      ...current,
      [check.id]: { status: "running", message: "正在调用底座能力..." }
    }));
    try {
      const detail = await check.run();
      setSmokeResults((current) => ({
        ...current,
        [check.id]: {
          status: "passed",
          message: "能力链路已通过。",
          durationMs: performance.now() - startedAt,
          detail
        }
      }));
    } catch (error) {
      setSmokeResults((current) => ({
        ...current,
        [check.id]: {
          status: "failed",
          message: error instanceof Error ? error.message : String(error),
          durationMs: performance.now() - startedAt,
          detail: error instanceof Error ? { name: error.name, message: error.message } : error
        }
      }));
    } finally {
      setRunningSmokeId((current) => (current === check.id ? null : current));
    }
  }

  async function runAllSmokes() {
    for (const check of smokeChecks) {
      await runSmoke(check);
    }
  }

  return (
    <AdminPageShell
      className="demo-settings-page"
      eyebrow="Foundation"
      title="底座验收台"
      description="这里不是业务管理页，而是给产品项目和外部 AI 对接时看的底座能力配置与自检面板。"
      actions={
        <div className="demo-settings-actions">
          <Button variant="outline" size="sm" onClick={() => void client.files.exportJson("desktop-diagnostics.json", { recentRequests, auditEvents, smokeResults }, { directory: "/tmp" })}>
            导出诊断
          </Button>
          <Button size="sm" loading={Boolean(runningSmokeId)} onClick={() => void runAllSmokes()}>
            一键自检
          </Button>
        </div>
      }
    >
      <div className="demo-foundation-hero">
        <div>
          <span>Foundation readiness</span>
          <strong>{completedChecks ? `${score}%` : "Ready"}</strong>
          <p>HTTP cache、multipart upload、update install、storage、diagnostics 都从同一个 DesktopClient 入口验证。</p>
        </div>
        <div className="demo-foundation-score">
          <Badge tone="success">pass {smokeCounts.passed}</Badge>
          <Badge tone="danger">fail {smokeCounts.failed}</Badge>
          <Badge tone="neutral">idle {smokeCounts.idle}</Badge>
        </div>
      </div>
      <div className="demo-settings-metrics">
        <AdminMetricCard label="HTTP cache" value="Rust" hint="memory / persistent" icon={<span>H</span>} tone="primary" />
        <AdminMetricCard label="Requests" value={recentRequests.length} hint="bridge diagnostics" icon={<span>R</span>} tone="info" />
        <AdminMetricCard label="Update" value={updateState.status} hint={updateState.currentVersion ?? "0.1.0"} icon={<span>U</span>} tone="success" />
        <AdminMetricCard label="Audit" value={auditEvents.length} hint="recent events" icon={<span>A</span>} tone="warning" />
      </div>
      <SettingsPage
        className="demo-settings-shell"
        activeSectionId={activeSectionId}
        onSectionSelect={(section) => setActiveSectionId(section.id)}
        sections={[
          {
            id: "overview",
            title: "能力总览",
            description: "产品侧配置和底座 storage / secure storage 的边界示意。",
            content: (
              <div className="demo-settings-stack">
                <div className="demo-capability-grid">
                  {[
                    ["HTTP", "Rust cache", "GET / POST / Multipart"],
                    ["Storage", "App / User / Secure", "session + KV"],
                    ["Files", "Export / Download", "/tmp sandbox"],
                    ["Update", "Manifest adapter", "install boundary"]
                  ].map(([label, value, detail]) => (
                    <div className="demo-capability-card" key={label}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                      <small>{detail}</small>
                    </div>
                  ))}
                </div>
                <EditableTable
                  columns={columns}
                  rows={flags}
                  rowKey="id"
                  onCellChange={(row, rowIndex, column, value) => {
                    setFlags((current) => current.map((item, index) => (index === rowIndex && column.accessor ? { ...item, [column.accessor]: value } : item)));
                    client.storage.set(`settings.${row.id}`, value);
                  }}
                />
              </div>
            )
          },
          {
            id: "smoke",
            title: "能力验收",
            description: "一键验证产品项目最常用的桌面能力。",
            content: <SmokePanel checks={smokeChecks} results={smokeResults} runningId={runningSmokeId} onRun={runSmoke} onRunAll={runAllSmokes} />
          },
          {
            id: "updates",
            title: "更新中心",
            description: "读取 public/update/latest.json，下载、校验并通过底座安装边界执行。",
            feature: "updates",
            content: (
              <div className="demo-update-panel">
                <UpdateCenterPanel
                  client={client}
                  showHeader={false}
                  showRawState
                  labels={{
                    check: "检查更新",
                    download: "下载",
                    install: "安装 adapter",
                    releasePage: "发布页",
                    idleMessage: "等待检查更新。"
                  }}
                />
              </div>
            )
          },
          {
            id: "link-proxy",
            title: "链接代理",
            description: "通过本地/VPN/内网代理请求外部链接，不把业务 token 默认透传给目标站点。",
            feature: "linkProxy",
            content: <LinkProxyPanel client={client} />
          },
          {
            id: "diagnostics",
            title: "诊断",
            description: "bridge 自动记录最近请求，产品可以直接接入 DebugPanel 或自定义诊断页。",
            permission: "diagnostics:read",
            feature: "diagnostics",
            content: (
              <div className="demo-settings-stack">
                <div className="demo-diagnostics-strip">
                  <Badge tone="info">requests {recentRequests.length}</Badge>
                  <Badge tone="warning">audit {auditEvents.length}</Badge>
                  <Button variant="ghost" size="sm" onClick={() => client.diagnostics.clearRecentRequests()}>
                    清空请求
                  </Button>
                </div>
                <CodeBlock>{JSON.stringify(recentRequests, null, 2)}</CodeBlock>
              </div>
            )
          },
          {
            id: "logs",
            title: "能力日志",
            description: "桌面能力调用记录。",
            content: <CodeBlock>{logs.join("\n") || "暂无调用记录。"}</CodeBlock>
          }
        ]}
      />
    </AdminPageShell>
  );
}
