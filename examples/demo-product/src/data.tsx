import type { DesktopMenuItem, TableColumn } from "@desktop-foundation/ui-react";
import { AdminCellText, AdminMono, AdminStatusPill, AmountText } from "@desktop-foundation/ui-react";
import type { LocaleContextValue } from "@desktop-foundation/ui-react";

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

function menuIcon(value: string) {
  return (
    <span className="demo-menu-icon" aria-hidden="true">
      {value}
    </span>
  );
}

export function createMenus(active: DemoScreen, t: LocaleContextValue["t"]): DesktopMenuItem[] {
  return [
    { id: "deposit", label: t("product.nav.deposit"), icon: menuIcon("↓"), href: "#orders", active: false, permission: "orders:read" },
    { id: "withdraw", label: t("product.nav.withdraw"), icon: menuIcon("↑"), href: "#orders", active: false, permission: "orders:read" },
    { id: "wallet", label: t("product.nav.wallet"), icon: menuIcon("≡"), href: "#orders", active: active === "orders", permission: "orders:read" },
    {
      id: "system",
      label: t("product.nav.system"),
      icon: menuIcon("S"),
      children: [
        { id: "admins", label: t("product.nav.admins"), icon: menuIcon("U"), href: "#settings", active: false, permission: "settings:read" },
        { id: "roles", label: t("product.nav.roles"), icon: menuIcon("R"), href: "#settings", active: false, permission: "settings:read" },
        { id: "menus", label: t("product.nav.menus"), icon: menuIcon("M"), href: "#settings", active: false, permission: "settings:read" },
        { id: "api", label: t("product.nav.api"), icon: menuIcon("A"), href: "#settings", active: false, permission: "settings:read" },
        { id: "release", label: t("product.nav.release"), icon: menuIcon("P"), href: "#settings", active: false, permission: "settings:read" },
        { id: "audit", label: t("product.nav.audit"), icon: menuIcon("L"), href: "#settings", active: false, permission: "diagnostics:read" },
        { id: "storage", label: t("product.nav.storage"), icon: menuIcon("D"), href: "#settings", active: false, permission: "settings:read" },
        { id: "dashboard", label: t("product.nav.dashboard"), icon: menuIcon("文"), href: "#dashboard", active: active === "dashboard" }
      ]
    },
    {
      id: "foundation",
      label: t("product.nav.business"),
      icon: menuIcon("F"),
      children: [
        { id: "orders", label: t("product.nav.orders"), icon: menuIcon("O"), href: "#orders", active: false, permission: "orders:read" },
        { id: "settings", label: t("product.nav.settings"), icon: menuIcon("C"), href: "#settings", active: active === "settings", permission: "settings:read" }
      ]
    }
  ];
}

export function createOrderColumns(t: LocaleContextValue["t"]): TableColumn<OrderRow>[] {
  return [
  { key: "id", header: t("product.orders.column.id"), render: (row) => <AdminMono copyValue={row.id}>{row.id}</AdminMono>, sortable: true, sticky: "left", minWidth: 190 },
  { key: "merchant", header: t("product.orders.column.customer"), render: (row) => <AdminCellText title={row.merchant} description={row.channel} />, sortable: true, minWidth: 180 },
  { key: "channel", header: t("product.orders.column.source"), accessor: "channel", minWidth: 100 },
  { key: "status", header: t("product.orders.column.status"), render: (row) => <AdminStatusPill status={row.status} />, minWidth: 100 },
  {
    key: "amount",
    header: t("product.orders.column.amount"),
    render: (row) => <AmountText value={row.amount} currency={row.currency} sign="never" />,
    sortValue: (row) => row.amount,
    sortable: true,
    align: "right",
    minWidth: 120
  },
  { key: "createdAt", header: t("product.orders.column.createdAt"), accessor: "createdAt", sortable: true, minWidth: 150 }
  ];
}
