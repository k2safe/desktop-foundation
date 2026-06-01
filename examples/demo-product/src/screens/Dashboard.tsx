import { Button, CodeBlock, ContentPanel, MetricGrid, PageHeader, ProgressBar } from "@desktop-foundation/ui-react";
import type { DesktopClient } from "@desktop-foundation/bridge";
import { orders } from "../data";

export interface DashboardProps {
  client: DesktopClient;
  logs: string[];
  onOpenCommands: () => void;
}

export function Dashboard({ client, logs, onOpenCommands }: DashboardProps) {
  const totalAmount = orders.reduce((sum, row) => sum + row.amount, 0);

  return (
    <>
      <PageHeader
        title="产品工作台"
        description="一个真实业务项目该怎么接入底座，这里只保留产品自己的数据、页面和文案。"
        actions={<Button onClick={onOpenCommands}>命令面板</Button>}
      />
      <MetricGrid
        metrics={[
          { id: "orders", label: "今日订单", value: orders.length, hint: "demo data", trend: "+12%" },
          { id: "amount", label: "成交金额", value: `$${totalAmount.toFixed(2)}`, hint: "USD" },
          { id: "secure", label: "安全存储", value: "ready", hint: "secure storage" },
          { id: "desktop", label: "桌面能力", value: "ready", hint: "files / notify" }
        ]}
      />
      <ProgressBar value={72} label="今日处理进度" />
      <ContentPanel
        title="底座能力冒烟"
        description="这些按钮走的是 bridge 的统一能力入口，真实 Tauri 产品可切换到 Rust command 或 native plugin。"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => void client.desktop.notify({ title: "Demo ready", body: "Desktop foundation is wired." })}>
              通知
            </Button>
            <Button variant="outline" size="sm" onClick={() => void client.files.exportJson("orders.json", orders, { directory: "/tmp" })}>
              导出 JSON
            </Button>
          </>
        }
      >
        <CodeBlock>{logs.join("\n") || "还没有能力调用记录。"}</CodeBlock>
      </ContentPanel>
    </>
  );
}
