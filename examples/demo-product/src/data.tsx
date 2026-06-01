import type { DesktopMenuItem, TableColumn } from "@desktop-foundation/ui-react";
import { AmountText, StatusTag } from "@desktop-foundation/ui-react";

export type DemoScreen = "dashboard" | "orders" | "settings";

export interface DemoUser {
  id: string;
  name: string;
  account: string;
  role: string;
  permissions: string[];
}

export interface OrderRow {
  id: string;
  merchant: string;
  channel: string;
  status: "success" | "pending" | "warning" | "danger";
  amount: number;
  currency: string;
  createdAt: string;
}

export const demoUser: DemoUser = {
  id: "u_demo_admin",
  name: "Demo Operator",
  account: "demo",
  role: "Operations",
  permissions: ["orders:read", "orders:export", "settings:read"]
};

export const orders: OrderRow[] = [
  { id: "PAY-20260601-001", merchant: "Acme Studio", channel: "Card", status: "success", amount: 1280.5, currency: "USD", createdAt: "2026-06-01 09:12" },
  { id: "PAY-20260601-002", merchant: "Northwind", channel: "Wallet", status: "pending", amount: 640, currency: "USD", createdAt: "2026-06-01 10:26" },
  { id: "PAY-20260601-003", merchant: "Blue Harbor", channel: "Bank", status: "warning", amount: 429.9, currency: "USD", createdAt: "2026-06-01 11:02" },
  { id: "PAY-20260601-004", merchant: "Orbit Labs", channel: "Card", status: "danger", amount: 96.2, currency: "USD", createdAt: "2026-06-01 12:18" }
];

export function createMenus(active: DemoScreen): DesktopMenuItem[] {
  return [
    { id: "dashboard", label: "工作台", href: "#dashboard", active: active === "dashboard" },
    {
      id: "business",
      label: "业务",
      children: [{ id: "orders", label: "订单中心", href: "#orders", active: active === "orders" }]
    },
    {
      id: "system",
      label: "系统",
      children: [{ id: "settings", label: "底座设置", href: "#settings", active: active === "settings" }]
    }
  ];
}

export const orderColumns: TableColumn<OrderRow>[] = [
  { key: "id", header: "订单号", accessor: "id", sortable: true, sticky: "left", minWidth: 170 },
  { key: "merchant", header: "商户", accessor: "merchant", sortable: true, minWidth: 140 },
  { key: "channel", header: "渠道", accessor: "channel", minWidth: 100 },
  { key: "status", header: "状态", render: (row) => <StatusTag status={row.status} />, minWidth: 100 },
  {
    key: "amount",
    header: "金额",
    render: (row) => <AmountText value={row.amount} currency={row.currency} sign="never" />,
    sortValue: (row) => row.amount,
    sortable: true,
    align: "right",
    minWidth: 120
  },
  { key: "createdAt", header: "创建时间", accessor: "createdAt", sortable: true, minWidth: 150 }
];
