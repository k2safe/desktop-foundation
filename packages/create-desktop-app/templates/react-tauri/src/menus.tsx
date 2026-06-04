import type { DesktopMenuItem } from "@desktop-foundation/ui-react";

export const menus: DesktopMenuItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "#dashboard",
    active: true,
    permission: "dashboard:read"
  },
  {
    id: "operations",
    label: "Operations",
    children: [
      { id: "orders", label: "Orders", href: "#orders", permission: "orders:read" },
      { id: "customers", label: "Customers", href: "#customers", permission: "customers:read" }
    ]
  },
  {
    id: "system",
    label: "System",
    children: [
      { id: "settings", label: "Settings", href: "#settings", permission: "settings:read" }
    ]
  }
];
