import type { DesktopTheme } from "@desktop-foundation/ui-react";
import { createThemeTemplateRuntime } from "@desktop-foundation/theme-presets";

export const demoProductTemplate = createThemeTemplateRuntime("admin", {
  id: "commerce-ops",
  brand: { name: "Commerce Ops" },
  colors: {
    primary: "#0f766e",
    primaryHover: "#115e59",
    primarySoft: "#ccfbf1",
    background: "#f7faf9",
    dark: "#0f172a",
    info: "#2563eb",
    success: "#059669",
    warning: "#b45309",
    danger: "#dc2626"
  }
});

export const demoProductTheme: DesktopTheme = demoProductTemplate.theme;
