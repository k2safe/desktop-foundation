import type { DesktopTheme } from "@desktop-foundation/ui-react";

export const productTheme: DesktopTheme = {
  id: "{{PRODUCT_ID}}",
  brand: {
    name: "{{APP_NAME}}"
  },
  colors: {
    primary: "#2563eb",
    primaryHover: "#1d4ed8",
    primarySoft: "#eff6ff",
    dark: "#111827",
    background: "#f3f4f6",
    surface: "#ffffff",
    elevated: "#ffffff",
    border: "#e5e7eb",
    strongBorder: "#d1d5db",
    text: "#111827",
    mutedText: "#6b7280",
    inverseText: "#ffffff",
    danger: "#dc2626",
    warning: "#d97706",
    success: "#059669",
    info: "#2563eb"
  },
  radius: {
    xs: "3px",
    sm: "4px",
    md: "6px",
    lg: "8px",
    xl: "10px"
  },
  density: "default"
};
