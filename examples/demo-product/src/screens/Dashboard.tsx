import { Button, CodeBlock, ContentPanel, MetricGrid, PageHeader, ProgressBar, useLocale } from "@desktop-foundation/ui-react";
import type { DesktopClient } from "@desktop-foundation/bridge";
import { orders } from "../data";

export interface DashboardProps {
  client: DesktopClient;
  logs: string[];
  onOpenCommands: () => void;
}

export function Dashboard({ client, logs, onOpenCommands }: DashboardProps) {
  const { format } = useLocale();
  const totalAmount = orders.reduce((sum, row) => sum + row.amount, 0);

  return (
    <>
      <PageHeader
        title="产品工作台"
        description="订单、指标、流程和桌面能力的运行概览，底座只提供通用能力。"
        actions={<Button onClick={onOpenCommands}>命令面板</Button>}
      />
      <MetricGrid
        metrics={[
          { id: "orders", label: "今日订单", value: orders.length, hint: "demo data", trend: "+12%" },
          { id: "amount", label: "业务金额", value: format.currency(totalAmount, "USD"), hint: "USD" },
          { id: "secure", label: "处理队列", value: "ready", hint: "workflow" },
          { id: "desktop", label: "桌面能力", value: "ready", hint: "files / notify" }
        ]}
      />
      <ProgressBar value={72} label="今日处理进度" />
      <ContentPanel
        title="桌面能力冒烟"
        description="这些按钮走的是 bridge 的统一能力入口，真实产品项目可切换到 Rust command 或 native plugin。"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => void client.desktop.notify({ title: "Product demo ready", body: "Desktop capabilities are wired." })}>
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
