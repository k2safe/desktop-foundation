import type { ReactNode } from "react";
import type { DesktopLoginTemplateSource } from "@desktop-foundation/app-shell";
import type { DesktopClientConfig } from "@desktop-foundation/bridge";
import {
  Button,
  type DesktopLayoutBrand,
  type DesktopLayoutVariant,
  type DesktopMenuItem,
  type DesktopTheme,
  type DesktopUser,
  type DesktopUserMenuItem,
  type LocaleCode,
  type LocaleDictionary
} from "@desktop-foundation/ui-react";
import { menus } from "./menus";
import { productTemplate, productTheme } from "./theme";

export interface ProductAdapter {
  productId: string;
  appName: string;
  theme: DesktopTheme;
  locale: LocaleCode;
  messages?: LocaleDictionary;
  dictionaries?: Record<string, LocaleDictionary>;
  className: string;
  layout: DesktopLayoutVariant;
  loginTemplate: DesktopLoginTemplateSource;
  brand: DesktopLayoutBrand;
  user: DesktopUser;
  menus: DesktopMenuItem[];
  userMenuItems?: DesktopUserMenuItem[];
  topbarRight?: ReactNode;
  clientDefaults: Pick<DesktopClientConfig, "product" | "apiBaseURL" | "tokenKey">;
}

export const productAdapter: ProductAdapter = {
  productId: "{{PRODUCT_ID}}",
  appName: "{{APP_NAME}}",
  theme: productTheme,
  locale: "en-US",
  className: productTemplate.className,
  layout: productTemplate.layout.appShell,
  loginTemplate: productTemplate.layout.login,
  brand: { name: "{{APP_NAME}}" },
  user: { name: "Admin", role: "Owner" },
  menus,
  topbarRight: <Button size="sm" variant="outline">Settings</Button>,
  clientDefaults: {
    product: "{{PRODUCT_ID}}",
    apiBaseURL: "{{API_BASE_URL}}",
    tokenKey: "{{PRODUCT_ID}}:desktop:token"
  }
};
