import type { DesktopTheme, ThemeDensity } from "./types";

export const densityTokens: Record<ThemeDensity, Record<string, string>> = {
  compact: {
    "--df-control-height": "32px",
    "--df-control-padding-x": "10px",
    "--df-layout-gap": "12px",
    "--df-table-row-height": "36px"
  },
  default: {
    "--df-control-height": "36px",
    "--df-control-padding-x": "12px",
    "--df-layout-gap": "16px",
    "--df-table-row-height": "44px"
  },
  comfortable: {
    "--df-control-height": "40px",
    "--df-control-padding-x": "14px",
    "--df-layout-gap": "20px",
    "--df-table-row-height": "52px"
  }
};

export const defaultTheme: DesktopTheme = {
  id: "desktop-foundation",
  mode: "light",
  brand: {
    name: "Desktop"
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
  shadow: {
    sm: "0 1px 2px rgba(15, 23, 42, 0.06)",
    md: "0 8px 24px rgba(15, 23, 42, 0.10)",
    lg: "0 20px 48px rgba(15, 23, 42, 0.16)"
  },
  typography: {
    sans: '"Inter", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", ui-sans-serif, system-ui, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    baseSize: "14px"
  },
  density: "default"
};
