import type { DesktopMenuItem, TableColumn } from "@desktop-foundation/ui-react";
import { AdminCellText, AdminMono, AdminStatusPill, AmountText } from "@desktop-foundation/ui-react";

export type DemoScreen = "dashboard" | "orders" | "settings";

export interface DemoUser {
  id: string;
  name: string;
  account: string;
  role: string;
  roles: string[];
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
  id: "u_demo_operator",
  name: "Demo Operator",
  account: "operator",
  role: "Operations",
  roles: ["operator"],
  permissions: ["orders:read", "orders:export", "catalog:read", "settings:read", "diagnostics:read"]
};

export const orders: OrderRow[] = [
  { id: "ORD-20260601-001", merchant: "Urban Outfitters", channel: "App Store", status: "success", amount: 1280.5, currency: "USD", createdAt: "2026-06-01 09:12" },
  { id: "ORD-20260601-002", merchant: "Northwind Market", channel: "Web Shop", status: "pending", amount: 640, currency: "USD", createdAt: "2026-06-01 10:26" },
  { id: "ORD-20260601-003", merchant: "Blue Harbor Home", channel: "Marketplace", status: "warning", amount: 429.9, currency: "USD", createdAt: "2026-06-01 11:02" },
  { id: "ORD-20260601-004", merchant: "Orbit Gadgets", channel: "POS", status: "danger", amount: 96.2, currency: "USD", createdAt: "2026-06-01 12:18" },
  { id: "ORD-20260601-005", merchant: "Acme Wholesale", channel: "API", status: "success", amount: 2840.25, currency: "USD", createdAt: "2026-06-01 13:05" },
  { id: "ORD-20260601-006", merchant: "Contoso Studio", channel: "Web Shop", status: "pending", amount: 312.48, currency: "USD", createdAt: "2026-06-01 13:44" },
  { id: "ORD-20260601-007", merchant: "Fabrikam Cloud", channel: "Marketplace", status: "success", amount: 1599, currency: "USD", createdAt: "2026-06-01 14:19" },
  { id: "ORD-20260601-008", merchant: "Litware Retail", channel: "POS", status: "warning", amount: 760.15, currency: "USD", createdAt: "2026-06-01 14:52" },
  { id: "ORD-20260601-009", merchant: "Tailspin Toys", channel: "API", status: "success", amount: 188.72, currency: "USD", createdAt: "2026-06-01 15:21" }
];

export function createMenus(active: DemoScreen): DesktopMenuItem[] {
  return [
    { id: "dashboard", label: "工作台", href: "#dashboard", active: active === "dashboard" },
    {
      id: "business",
      label: "业务",
      children: [{ id: "orders", label: "订单中心", href: "#orders", active: active === "orders", permission: "orders:read" }]
    },
    {
      id: "system",
      label: "系统",
      children: [{ id: "settings", label: "底座设置", href: "#settings", active: active === "settings", permission: "settings:read" }]
    }
  ];
}

export const orderColumns: TableColumn<OrderRow>[] = [
  { key: "id", header: "订单号", render: (row) => <AdminMono copyValue={row.id}>{row.id}</AdminMono>, sortable: true, sticky: "left", minWidth: 190 },
  { key: "merchant", header: "客户", render: (row) => <AdminCellText title={row.merchant} description={row.channel} />, sortable: true, minWidth: 180 },
  { key: "channel", header: "来源", accessor: "channel", minWidth: 100 },
  { key: "status", header: "状态", render: (row) => <AdminStatusPill status={row.status} />, minWidth: 100 },
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
