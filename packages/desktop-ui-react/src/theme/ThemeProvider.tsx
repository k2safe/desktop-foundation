import type { CSSProperties } from "react";
import { cn } from "../utils/cn";
import { defaultTheme, densityTokens } from "./defaultTheme";
import type { DesktopTheme, DesktopThemeInput, ThemeProviderProps } from "./types";

function mergeTheme(theme?: DesktopThemeInput): DesktopTheme {
  return {
    ...defaultTheme,
    ...theme,
    brand: {
      ...defaultTheme.brand,
      ...theme?.brand,
      name: theme?.brand?.name ?? defaultTheme.brand?.name ?? "Desktop"
    },
    colors: {
      ...defaultTheme.colors,
      ...theme?.colors
    },
    radius: {
      ...defaultTheme.radius,
      ...theme?.radius
    },
    shadow: {
      ...defaultTheme.shadow,
      ...theme?.shadow
    },
    typography: {
      ...defaultTheme.typography,
      ...theme?.typography
    }
  };
}

export function themeToCssVariables(themeInput?: DesktopThemeInput): CSSProperties {
  const theme = mergeTheme(themeInput);
  const density = theme.density ?? "default";

  return {
    "--df-color-primary": theme.colors.primary,
    "--df-color-primary-hover": theme.colors.primaryHover,
    "--df-color-primary-soft": theme.colors.primarySoft,
    "--df-color-dark": theme.colors.dark,
    "--df-color-bg": theme.colors.background,
    "--df-color-surface": theme.colors.surface,
    "--df-color-elevated": theme.colors.elevated,
    "--df-color-border": theme.colors.border,
    "--df-color-border-strong": theme.colors.strongBorder,
    "--df-color-text": theme.colors.text,
    "--df-color-text-muted": theme.colors.mutedText,
    "--df-color-text-inverse": theme.colors.inverseText,
    "--df-color-danger": theme.colors.danger,
    "--df-color-warning": theme.colors.warning,
    "--df-color-success": theme.colors.success,
    "--df-color-info": theme.colors.info,
    "--df-radius-xs": theme.radius.xs,
    "--df-radius-sm": theme.radius.sm,
    "--df-radius-md": theme.radius.md,
    "--df-radius-lg": theme.radius.lg,
    "--df-radius-xl": theme.radius.xl,
    "--df-shadow-sm": theme.shadow?.sm,
    "--df-shadow-md": theme.shadow?.md,
    "--df-shadow-lg": theme.shadow?.lg,
    "--df-font-sans": theme.typography?.sans,
    "--df-font-mono": theme.typography?.mono,
    "--df-font-size-base": theme.typography?.baseSize,
    ...densityTokens[density]
  } as CSSProperties;
}

export function ThemeProvider({ theme, mode, className, style, children }: ThemeProviderProps) {
  const mergedTheme = mergeTheme(theme);
  const dataMode = mode ?? theme?.mode ?? mergedTheme.mode ?? "light";

  return (
    <div
      className={cn("df-theme", className)}
      data-theme={dataMode}
      style={{ ...themeToCssVariables(mergedTheme), ...style }}
    >
      {children}
    </div>
  );
}
