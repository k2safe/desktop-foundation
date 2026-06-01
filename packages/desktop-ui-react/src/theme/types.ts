import type { CSSProperties, ReactNode } from "react";

export type ThemeDensity = "compact" | "default" | "comfortable";
export type ThemeMode = "light" | "dark";

export interface ThemeBrand {
  name: string;
  logo?: ReactNode;
  mark?: ReactNode;
}

export interface ThemeColors {
  primary: string;
  primaryHover?: string;
  primarySoft?: string;
  dark: string;
  background: string;
  surface: string;
  elevated: string;
  border: string;
  strongBorder?: string;
  text: string;
  mutedText: string;
  inverseText?: string;
  danger: string;
  warning: string;
  success: string;
  info: string;
}

export interface ThemeRadius {
  xs?: string;
  sm: string;
  md: string;
  lg: string;
  xl?: string;
}

export interface ThemeShadow {
  sm?: string;
  md?: string;
  lg?: string;
}

export interface ThemeTypography {
  sans?: string;
  mono?: string;
  baseSize?: string;
}

export interface DesktopTheme {
  id?: string;
  mode?: ThemeMode;
  brand?: ThemeBrand;
  colors: ThemeColors;
  radius: ThemeRadius;
  shadow?: ThemeShadow;
  typography?: ThemeTypography;
  density?: ThemeDensity;
}

export type DesktopThemeInput = Partial<Omit<DesktopTheme, "brand" | "colors" | "radius" | "shadow" | "typography">> & {
  brand?: Partial<ThemeBrand>;
  colors?: Partial<ThemeColors>;
  radius?: Partial<ThemeRadius>;
  shadow?: Partial<ThemeShadow>;
  typography?: Partial<ThemeTypography>;
};

export interface ThemeProviderProps {
  theme?: DesktopThemeInput;
  mode?: ThemeMode;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}
