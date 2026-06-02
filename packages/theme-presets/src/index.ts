import type { DesktopLayoutVariant, DesktopTheme, DesktopThemeInput, LoginShellVariant } from "@desktop-foundation/ui-react";

export type ThemeTemplateCategory = "system" | "admin" | "merchant" | "dark";
export type ThemeTemplateSurfaceVariant = "crisp" | "glass" | "dense";

export interface ThemeTemplatePreview {
  primary: string;
  chrome: string;
  background: string;
  surface: string;
}

export interface ThemeTemplateLayout {
  appShell: DesktopLayoutVariant;
  login: LoginShellVariant;
  surface: ThemeTemplateSurfaceVariant;
}

export interface ThemeTemplate {
  id: string;
  name: string;
  description: string;
  category: ThemeTemplateCategory;
  preview: ThemeTemplatePreview;
  layout: ThemeTemplateLayout;
  className: string;
  theme: DesktopTheme;
}

export type ThemeTemplateSource = ThemeTemplate | ThemeTemplateId | string;

function mergeTheme(base: DesktopTheme, overrides: DesktopThemeInput = {}): DesktopTheme {
  return {
    ...base,
    ...overrides,
    brand: {
      ...base.brand,
      ...overrides.brand,
      name: overrides.brand?.name ?? base.brand?.name ?? "Desktop"
    },
    colors: {
      ...base.colors,
      ...overrides.colors
    },
    radius: {
      ...base.radius,
      ...overrides.radius
    },
    shadow: {
      ...base.shadow,
      ...overrides.shadow
    },
    typography: {
      ...base.typography,
      ...overrides.typography
    }
  };
}

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
    primary: "#3b00f5",
    primaryHover: "#2700c7",
    primarySoft: "#f0ebff",
    dark: "#050017",
    background: "#f3f5f9",
    surface: "#ffffff",
    elevated: "#fbfcff",
    border: "#e5e9f2",
    strongBorder: "#cbd4e3",
    text: "#111827",
    mutedText: "#667085",
    success: "#10b981",
    warning: "#f97316",
    info: "#0e7490"
  },
  shadow: {
    sm: "0 1px 2px rgba(16, 24, 40, 0.06)",
    md: "0 10px 30px rgba(16, 24, 40, 0.08)",
    lg: "0 24px 64px rgba(16, 24, 40, 0.16)"
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

export const defaultThemeTemplate: ThemeTemplate = {
  id: "default",
  name: "Foundation Light",
  description: "Neutral split-login and sidebar template for general desktop products.",
  category: "system",
  preview: {
    primary: defaultThemePreset.colors.primary,
    chrome: defaultThemePreset.colors.dark,
    background: defaultThemePreset.colors.background,
    surface: defaultThemePreset.colors.surface
  },
  layout: {
    appShell: "sidebar",
    login: "split",
    surface: "crisp"
  },
  className: "df-template-default df-surface-crisp",
  theme: defaultThemePreset
};

export const adminThemeTemplate: ThemeTemplate = {
  id: "admin",
  name: "Tech Admin",
  description: "Dark sidebar chrome, split login, precise panels, and high-density admin surfaces.",
  category: "admin",
  preview: {
    primary: adminThemePreset.colors.primary,
    chrome: adminThemePreset.colors.dark,
    background: adminThemePreset.colors.background,
    surface: adminThemePreset.colors.surface
  },
  layout: {
    appShell: "sidebar",
    login: "split",
    surface: "dense"
  },
  className: "df-template-admin df-surface-dense",
  theme: adminThemePreset
};

export const merchantThemeTemplate: ThemeTemplate = {
  id: "merchant",
  name: "Merchant Ops",
  description: "Top navigation, centered login, and softer operational surfaces for service consoles.",
  category: "merchant",
  preview: {
    primary: merchantThemePreset.colors.primary,
    chrome: merchantThemePreset.colors.dark,
    background: merchantThemePreset.colors.background,
    surface: merchantThemePreset.colors.surface
  },
  layout: {
    appShell: "topnav",
    login: "centered",
    surface: "glass"
  },
  className: "df-template-merchant df-surface-glass",
  theme: merchantThemePreset
};

export const darkThemeTemplate: ThemeTemplate = {
  id: "dark",
  name: "Midnight Console",
  description: "Top navigation, workbench login, and compact dark monitoring surfaces.",
  category: "dark",
  preview: {
    primary: darkThemePreset.colors.primary,
    chrome: darkThemePreset.colors.dark,
    background: darkThemePreset.colors.background,
    surface: darkThemePreset.colors.surface
  },
  layout: {
    appShell: "topnav",
    login: "workbench",
    surface: "dense"
  },
  className: "df-template-midnight df-surface-dense",
  theme: darkThemePreset
};

export const themeTemplateMap = {
  default: defaultThemeTemplate,
  admin: adminThemeTemplate,
  merchant: merchantThemeTemplate,
  dark: darkThemeTemplate
};

export type ThemeTemplateId = keyof typeof themeTemplateMap;

export const themeTemplates: ThemeTemplate[] = [
  defaultThemeTemplate,
  adminThemeTemplate,
  merchantThemeTemplate,
  darkThemeTemplate
];

export const themePresets = {
  default: defaultThemePreset,
  admin: adminThemePreset,
  merchant: merchantThemePreset,
  dark: darkThemePreset
};

export function getThemeTemplate(templateId: ThemeTemplateId | string): ThemeTemplate {
  return themeTemplateMap[templateId as ThemeTemplateId] ?? defaultThemeTemplate;
}

export function resolveThemeTemplate(template: ThemeTemplateSource): ThemeTemplate {
  return typeof template === "string" ? getThemeTemplate(template) : template;
}

export function createThemeFromTemplate(template: ThemeTemplateSource, overrides?: DesktopThemeInput): DesktopTheme {
  return mergeTheme(resolveThemeTemplate(template).theme, overrides);
}

export function getThemeTemplateLayout(template: ThemeTemplateSource): ThemeTemplateLayout {
  return resolveThemeTemplate(template).layout;
}

export function getThemeTemplateClassName(template: ThemeTemplateSource): string {
  return resolveThemeTemplate(template).className;
}

export function createThemeTemplateRuntime(template: ThemeTemplateSource, overrides?: DesktopThemeInput) {
  const resolved = resolveThemeTemplate(template);

  return {
    id: resolved.id,
    name: resolved.name,
    theme: mergeTheme(resolved.theme, overrides),
    layout: resolved.layout,
    className: resolved.className
  };
}
