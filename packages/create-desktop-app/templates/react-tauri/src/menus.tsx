import type { DesktopMenuItem } from "@desktop-foundation/ui-react";

export const menus: DesktopMenuItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "#dashboard",
    active: true
  },
  {
    id: "operations",
    label: "Operations",
    children: [
      { id: "orders", label: "Orders", href: "#orders" },
      { id: "customers", label: "Customers", href: "#customers" }
    ]
  },
  {
    id: "system",
    label: "System",
    children: [
      { id: "settings", label: "Settings", href: "#settings" }
    ]
  }
];
