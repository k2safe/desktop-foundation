import { useState } from "react";
import { Button, CodeBlock, EditableTable, SettingsPage, type EditableTableColumn } from "@desktop-foundation/ui-react";
import type { AppUpdateState, DesktopClient } from "@desktop-foundation/bridge";

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

function UpdateCenter({ client }: { client: DesktopClient }) {
  const [state, setState] = useState<AppUpdateState>(() => client.updates.getState());
  const [message, setMessage] = useState("等待检查更新。");

  async function run(label: string, task: () => Promise<unknown>) {
    setMessage(`${label}...`);
    try {
      const result = await task();
      setMessage(`${label}完成`);
      return result;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      return null;
    } finally {
      setState(client.updates.getState());
    }
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <Button size="sm" onClick={() => void run("检查", () => client.updates.checkForUpdate())}>
          检查更新
        </Button>
        <Button size="sm" variant="outline" onClick={() => void run("下载", () => client.updates.downloadUpdate())}>
          下载
        </Button>
        <Button size="sm" variant="outline" onClick={() => void run("安装", () => client.updates.installUpdate())}>
          安装
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void run("打开发布页", () => client.updates.openUpdatePage())}>
          发布页
        </Button>
      </div>
      <CodeBlock>{message}</CodeBlock>
      <CodeBlock>{JSON.stringify(state, null, 2)}</CodeBlock>
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
          description: "读取 public/update/latest.json，走 bridge manifest 更新状态流转。",
          content: <UpdateCenter client={client} />
        },
        {
          id: "link-proxy",
          title: "链接代理",
          description: "通过本地/VPN/内网代理请求外部链接，不把业务 token 默认透传给目标站点。",
          content: <LinkProxyPanel client={client} />
        },
        {
          id: "diagnostics",
          title: "诊断",
          description: "bridge 自动记录最近请求，产品可以直接接入 DebugPanel 或自定义诊断页。",
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
