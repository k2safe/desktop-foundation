import { useState } from "react";
import { AdminMetricCard, AdminPageShell, Badge, Button, CodeBlock, ContentPanel, EditableTable, SettingsPage, type EditableTableColumn } from "@desktop-foundation/ui-react";
import { UpdateCenterPanel } from "@desktop-foundation/app-shell";
import type { DesktopClient, HttpResponseMeta } from "@desktop-foundation/bridge";

interface RuntimeFlag {
  id: string;
  name: string;
  value: string;
  scope: string;
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

function SmokePanel({ client }: { client: DesktopClient }) {
  const [result, setResult] = useState("等待能力验收。");

  async function runSmoke(label: string, action: () => Promise<unknown>) {
    setResult(`${label}...`);
    try {
      const payload = await action();
      setResult(JSON.stringify(payload, null, 2));
    } catch (error) {
      setResult(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <ContentPanel className="demo-smoke-panel" title="桌面能力验收" description="这些按钮都走底座 DesktopClient，真实业务项目只替换自己的页面和接口。">
      <div className="demo-smoke-actions">
        <Button size="sm" onClick={() => void runSmoke("notify", () => client.desktop.notify({ title: "Product Demo", body: "notify capability ok" }).then(() => ({ ok: true })))}>
          通知
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            void runSmoke("http cache", async () => {
              let meta: HttpResponseMeta | undefined;
              const payload = await client.http.get("/demo-api/languages.json", {
                auth: false,
                cache: { key: "settings:languages", ttlMs: 60_000, storage: "persistent", staleIfError: true },
                onResponse: (nextMeta) => {
                  meta = nextMeta;
                }
              });
              return { payload, response: meta };
            })
          }
        >
          HTTP cache
        </Button>
        <Button variant="outline" size="sm" onClick={() => void runSmoke("export", () => client.files.exportJson("foundation-smoke.json", { ok: true }, { directory: "/tmp" }))}>
          导出文件
        </Button>
        <Button variant="ghost" size="sm" onClick={() => void runSmoke("window", () => client.desktop.getWindowState())}>
          窗口状态
        </Button>
      </div>
      <CodeBlock>{result}</CodeBlock>
    </ContentPanel>
  );
}

export function Settings({ client, logs }: SettingsProps) {
  const [activeSectionId, setActiveSectionId] = useState("runtime");
  const [flags, setFlags] = useState<RuntimeFlag[]>([
    { id: "api", name: "apiBaseURL", value: "https://api.product-demo.local", scope: "app" },
    { id: "manifest", name: "updateManifest", value: "/update/latest.json", scope: "app" },
    { id: "token", name: "refreshToken", value: "secure-storage", scope: "secure" },
    { id: "density", name: "tableDensity", value: "default", scope: "user" }
  ]);
  const recentRequests = client.diagnostics.getRecentRequests();
  const auditEvents = client.diagnostics.getRecentAuditEvents();
  const updateState = client.updates.getState();

  return (
    <AdminPageShell
      className="demo-settings-page"
      eyebrow="Foundation"
      title="底座设置"
      description="这里不是业务管理页，而是给产品项目和外部 AI 对接时看的底座能力配置台。"
      actions={
        <Button variant="outline" size="sm" onClick={() => void client.files.exportJson("desktop-diagnostics.json", { recentRequests, auditEvents }, { directory: "/tmp" })}>
          导出诊断
        </Button>
      }
    >
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
            id: "runtime",
            title: "运行时",
            description: "产品侧配置和底座 storage / secure storage 的边界示意。",
            content: (
              <div className="demo-settings-stack">
                <div className="demo-capability-grid">
                  {[
                    ["HTTP", "Rust cache", "GET/POST/Multipart"],
                    ["Storage", "App/User/Secure", "session + KV"],
                    ["Files", "Export/Download", "/tmp sandbox"],
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
            content: <SmokePanel client={client} />
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
