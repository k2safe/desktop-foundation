import { useState } from "react";
import { CodeBlock, EditableTable, SettingsPage, type EditableTableColumn } from "@desktop-foundation/ui-react";
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

export function Settings({ client, logs }: SettingsProps) {
  const [activeSectionId, setActiveSectionId] = useState("runtime");
  const [flags, setFlags] = useState<RuntimeFlag[]>([
    { id: "api", name: "apiBaseURL", value: "https://api.foundation-demo.local", scope: "app" },
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
