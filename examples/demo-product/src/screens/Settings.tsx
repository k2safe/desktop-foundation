import { useState } from "react";
import { Button, CodeBlock, EditableTable, SettingsPage, type EditableTableColumn } from "@desktop-foundation/ui-react";
import { UpdateCenterPanel } from "@desktop-foundation/app-shell";
import type { DesktopClient } from "@desktop-foundation/bridge";

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
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <Button size="sm" onClick={() => void runProxyRequest()}>
          请求链接
        </Button>
      </div>
      <CodeBlock>{result}</CodeBlock>
    </div>
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

  return (
    <SettingsPage
      activeSectionId={activeSectionId}
      onSectionSelect={(section) => setActiveSectionId(section.id)}
      sections={[
        {
          id: "runtime",
          title: "运行时",
          description: "产品侧配置和底座 storage / secure storage 的边界示意。",
          content: (
            <EditableTable
              columns={columns}
              rows={flags}
              rowKey="id"
              onCellChange={(row, rowIndex, column, value) => {
                setFlags((current) => current.map((item, index) => (index === rowIndex && column.accessor ? { ...item, [column.accessor]: value } : item)));
                client.storage.set(`settings.${row.id}`, value);
              }}
            />
          )
        },
        {
          id: "updates",
          title: "更新中心",
          description: "读取 public/update/latest.json，下载、校验并通过底座安装边界执行。",
          feature: "updates",
          content: (
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
          content: <CodeBlock>{JSON.stringify(client.diagnostics.getRecentRequests(), null, 2)}</CodeBlock>
        },
        {
          id: "logs",
          title: "能力日志",
          description: "桌面能力调用记录。",
          content: <CodeBlock>{logs.join("\n") || "暂无调用记录。"}</CodeBlock>
        }
      ]}
    />
  );
}
