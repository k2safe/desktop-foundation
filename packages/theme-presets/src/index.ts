import type { DesktopTheme } from "@desktop-foundation/ui-react";

export const defaultThemePreset: DesktopTheme = {
  id: "default",
  brand: { name: "Desktop" },
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
  radius: { xs: "3px", sm: "4px", md: "6px", lg: "8px", xl: "10px" },
  density: "default"
};

export const adminThemePreset: DesktopTheme = {
  ...defaultThemePreset,
  id: "admin",
  brand: { name: "Admin" },
  colors: {
    ...defaultThemePreset.colors,
    primary: "#3400e9",
    primaryHover: "#2700b8",
    primarySoft: "#eee9ff",
    dark: "#020017",
    background: "#f2f4f7",
    border: "#e6e9ef",
    strongBorder: "#cfd6e2",
    mutedText: "#667085",
    success: "#10b981",
    warning: "#f97316",
    info: "#0e7490"
  }
};

export const merchantThemePreset: DesktopTheme = {
  ...defaultThemePreset,
  id: "merchant",
  brand: { name: "Merchant" },
  colors: {
    ...defaultThemePreset.colors,
    primary: "#0f9f6e",
    primaryHover: "#0b815a",
    primarySoft: "#ecfdf5",
    dark: "#061814",
    background: "#f4f8f6",
    success: "#0f9f6e"
  }
};

export const darkThemePreset: DesktopTheme = {
  ...defaultThemePreset,
  id: "dark",
  mode: "dark",
  brand: { name: "Desktop Dark" },
  colors: {
    primary: "#7c9cff",
    primaryHover: "#9bb3ff",
    primarySoft: "#172554",
    dark: "#050816",
    background: "#090d1a",
    surface: "#111827",
    elevated: "#172033",
    border: "#273244",
    strongBorder: "#3b4658",
    text: "#f8fafc",
    mutedText: "#a8b3c5",
    inverseText: "#ffffff",
    danger: "#fb7185",
    warning: "#fbbf24",
    success: "#34d399",
    info: "#60a5fa"
  }
};

export const themePresets = {
  default: defaultThemePreset,
  admin: adminThemePreset,
  merchant: merchantThemePreset,
  dark: darkThemePreset
};
