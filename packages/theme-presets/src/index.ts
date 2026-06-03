import type { DesktopLayoutVariant, DesktopTheme, DesktopThemeInput, LoginShellVariant } from "@desktop-foundation/ui-react";

export type ThemeTemplateCategory = "system" | "admin" | "merchant" | "dark" | "ops" | "finance" | "minimal";
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

export type WindowChromePresetId = "foundation" | "native" | "frameless";
export type WindowChromePlatform = "macos" | "windows" | "linux";
export type TauriTitleBarStyle = "Visible" | "Transparent" | "Overlay";

export interface LogicalPosition {
  x: number;
  y: number;
}

export interface PlatformWindowChrome {
  decorations?: boolean;
  hiddenTitle?: boolean;
  titleBarStyle?: TauriTitleBarStyle;
  trafficLightPosition?: LogicalPosition;
  backgroundColor?: string;
  shadow?: boolean;
  transparent?: boolean;
}

export interface WindowChromePreset {
  id: WindowChromePresetId;
  name: string;
  description: string;
  defaultBackgroundColor: string;
  platforms: Record<WindowChromePlatform, PlatformWindowChrome>;
}

export interface TauriWindowChromeConfig extends PlatformWindowChrome {
  backgroundColor?: string;
}

export const foundationWindowChromePreset: WindowChromePreset = {
  id: "foundation",
  name: "Foundation Chrome",
  description: "Overlay macOS title bar with native window controls and conservative decorated windows elsewhere.",
  defaultBackgroundColor: "#050314",
  platforms: {
    macos: {
      decorations: true,
      hiddenTitle: true,
      titleBarStyle: "Overlay",
      trafficLightPosition: { x: 18, y: 18 },
      backgroundColor: "#050314",
      shadow: true
    },
    windows: {
      decorations: true,
      backgroundColor: "#050314",
      shadow: true
    },
    linux: {
      decorations: true,
      backgroundColor: "#050314",
      shadow: true
    }
  }
};

export const nativeWindowChromePreset: WindowChromePreset = {
  id: "native",
  name: "Native Chrome",
  description: "Keep the operating system title bar intact for products that prefer platform defaults.",
  defaultBackgroundColor: "#ffffff",
  platforms: {
    macos: { decorations: true, hiddenTitle: false, titleBarStyle: "Visible", backgroundColor: "#ffffff", shadow: true },
    windows: { decorations: true, backgroundColor: "#ffffff", shadow: true },
    linux: { decorations: true, backgroundColor: "#ffffff", shadow: true }
  }
};

export const framelessWindowChromePreset: WindowChromePreset = {
  id: "frameless",
  name: "Frameless Chrome",
  description: "No native decorations. Product apps must provide their own drag and window controls.",
  defaultBackgroundColor: "#050314",
  platforms: {
    macos: { decorations: false, hiddenTitle: true, backgroundColor: "#050314", shadow: true },
    windows: { decorations: false, backgroundColor: "#050314", shadow: true },
    linux: { decorations: false, backgroundColor: "#050314", shadow: true }
  }
};

export const windowChromePresets = {
  foundation: foundationWindowChromePreset,
  native: nativeWindowChromePreset,
  frameless: framelessWindowChromePreset
};

export function getWindowChromePreset(presetId: WindowChromePresetId | string = "foundation"): WindowChromePreset {
  return windowChromePresets[presetId as WindowChromePresetId] ?? foundationWindowChromePreset;
}

export function getWindowChromePlatformConfig(
  preset: WindowChromePresetId | WindowChromePreset = "foundation",
  platform: WindowChromePlatform = "macos"
): PlatformWindowChrome {
  const resolved = typeof preset === "string" ? getWindowChromePreset(preset) : preset;
  return resolved.platforms[platform];
}

export function createTauriWindowChromeConfig(
  preset: WindowChromePresetId | WindowChromePreset = "foundation",
  platform: WindowChromePlatform = "macos"
): TauriWindowChromeConfig {
  const resolved = typeof preset === "string" ? getWindowChromePreset(preset) : preset;
  const chrome = resolved.platforms[platform];
  return {
    ...chrome,
    backgroundColor: chrome.backgroundColor ?? resolved.defaultBackgroundColor
  };
}

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

export const commandThemePreset: DesktopTheme = {
  ...defaultThemePreset,
  id: "command",
  brand: { name: "Command" },
  colors: {
    ...defaultThemePreset.colors,
    primary: "#0f62fe",
    primaryHover: "#0047c7",
    primarySoft: "#e0f2fe",
    dark: "#08111f",
    background: "#edf3f8",
    surface: "#ffffff",
    elevated: "#f8fbff",
    border: "#dbe5ef",
    strongBorder: "#b9c7d8",
    text: "#101828",
    mutedText: "#607086",
    success: "#12b981",
    warning: "#d97706",
    info: "#0891b2"
  },
  density: "compact"
};

export const topnavOpsThemePreset: DesktopTheme = {
  ...defaultThemePreset,
  id: "topnav-ops",
  brand: { name: "Operations" },
  colors: {
    ...defaultThemePreset.colors,
    primary: "#0e8f88",
    primaryHover: "#0b6f69",
    primarySoft: "#dff7f3",
    dark: "#111827",
    background: "#eef4f2",
    surface: "#ffffff",
    elevated: "#f8fbfa",
    border: "#d8e4df",
    strongBorder: "#b8c9c2",
    text: "#111827",
    mutedText: "#5f6f68",
    success: "#0f9f6e",
    warning: "#b7791f",
    info: "#0e7490"
  },
  density: "compact",
  shadow: {
    sm: "0 1px 2px rgba(17, 24, 39, 0.06)",
    md: "0 12px 32px rgba(17, 24, 39, 0.10)",
    lg: "0 28px 72px rgba(17, 24, 39, 0.18)"
  }
};

export const ledgerThemePreset: DesktopTheme = {
  ...defaultThemePreset,
  id: "ledger",
  brand: { name: "Ledger" },
  colors: {
    ...defaultThemePreset.colors,
    primary: "#177e5f",
    primaryHover: "#10674d",
    primarySoft: "#e9f8f1",
    dark: "#0f1720",
    background: "#f4f7f2",
    surface: "#ffffff",
    elevated: "#fbfcf8",
    border: "#dfe7dc",
    strongBorder: "#bdcabb",
    text: "#111827",
    mutedText: "#66725f",
    success: "#177e5f",
    warning: "#b7791f",
    info: "#2563eb"
  }
};

export const studioThemePreset: DesktopTheme = {
  ...defaultThemePreset,
  id: "studio",
  brand: { name: "Studio" },
  colors: {
    ...defaultThemePreset.colors,
    primary: "#365ac7",
    primaryHover: "#2947a3",
    primarySoft: "#edf2ff",
    dark: "#162033",
    background: "#f6f7fb",
    surface: "#ffffff",
    elevated: "#ffffff",
    border: "#e0e5ef",
    strongBorder: "#c2cada",
    text: "#111827",
    mutedText: "#697386",
    success: "#14a46c",
    warning: "#c47a14",
    info: "#2563eb"
  },
  density: "comfortable"
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
  description: "Dark sidebar chrome, brand split login, precise panels, and high-density admin surfaces.",
  category: "admin",
  preview: {
    primary: adminThemePreset.colors.primary,
    chrome: adminThemePreset.colors.dark,
    background: adminThemePreset.colors.background,
    surface: adminThemePreset.colors.surface
  },
  layout: {
    appShell: "sidebar",
    login: "brand-split",
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

export const commandThemeTemplate: ThemeTemplate = {
  id: "command",
  name: "Command Center",
  description: "Top navigation, workbench login, and telemetry-friendly dense surfaces for operations consoles.",
  category: "ops",
  preview: {
    primary: commandThemePreset.colors.primary,
    chrome: commandThemePreset.colors.dark,
    background: commandThemePreset.colors.background,
    surface: commandThemePreset.colors.surface
  },
  layout: {
    appShell: "topnav",
    login: "workbench",
    surface: "dense"
  },
  className: "df-template-command df-surface-dense",
  theme: commandThemePreset
};

export const topnavOpsThemeTemplate: ThemeTemplate = {
  id: "topnav-ops",
  name: "Topnav Operations",
  description: "Top navigation, workbench login, compact controls, and calm technical surfaces for operations products.",
  category: "ops",
  preview: {
    primary: topnavOpsThemePreset.colors.primary,
    chrome: topnavOpsThemePreset.colors.dark,
    background: topnavOpsThemePreset.colors.background,
    surface: topnavOpsThemePreset.colors.surface
  },
  layout: {
    appShell: "topnav",
    login: "workbench",
    surface: "dense"
  },
  className: "df-template-topnav-ops df-surface-dense",
  theme: topnavOpsThemePreset
};

export const ledgerThemeTemplate: ThemeTemplate = {
  id: "ledger",
  name: "Ledger Console",
  description: "Top navigation, centered login, and crisp financial tables for reconciliation tools.",
  category: "finance",
  preview: {
    primary: ledgerThemePreset.colors.primary,
    chrome: ledgerThemePreset.colors.dark,
    background: ledgerThemePreset.colors.background,
    surface: ledgerThemePreset.colors.surface
  },
  layout: {
    appShell: "topnav",
    login: "centered",
    surface: "crisp"
  },
  className: "df-template-ledger df-surface-crisp",
  theme: ledgerThemePreset
};

export const studioThemeTemplate: ThemeTemplate = {
  id: "studio",
  name: "Clean Studio",
  description: "Top navigation, split login, relaxed controls, and glass surfaces for lighter SaaS products.",
  category: "minimal",
  preview: {
    primary: studioThemePreset.colors.primary,
    chrome: studioThemePreset.colors.dark,
    background: studioThemePreset.colors.background,
    surface: studioThemePreset.colors.surface
  },
  layout: {
    appShell: "topnav",
    login: "split",
    surface: "glass"
  },
  className: "df-template-studio df-surface-glass",
  theme: studioThemePreset
};

export const themeTemplateMap = {
  default: defaultThemeTemplate,
  admin: adminThemeTemplate,
  command: commandThemeTemplate,
  "topnav-ops": topnavOpsThemeTemplate,
  merchant: merchantThemeTemplate,
  ledger: ledgerThemeTemplate,
  studio: studioThemeTemplate,
  dark: darkThemeTemplate
};

export type ThemeTemplateId = keyof typeof themeTemplateMap;

export const themeTemplates: ThemeTemplate[] = [
  defaultThemeTemplate,
  adminThemeTemplate,
  commandThemeTemplate,
  topnavOpsThemeTemplate,
  merchantThemeTemplate,
  ledgerThemeTemplate,
  studioThemeTemplate,
  darkThemeTemplate
];

export const themePresets = {
  default: defaultThemePreset,
  admin: adminThemePreset,
  command: commandThemePreset,
  "topnav-ops": topnavOpsThemePreset,
  merchant: merchantThemePreset,
  ledger: ledgerThemePreset,
  studio: studioThemePreset,
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
