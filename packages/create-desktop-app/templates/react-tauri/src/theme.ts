import type { DesktopTheme } from "@desktop-foundation/ui-react";
import { createThemeTemplateRuntime } from "@desktop-foundation/theme-presets";

export const productTemplate = createThemeTemplateRuntime("admin", {
  id: "{{PRODUCT_ID}}",
  brand: {
    name: "{{APP_NAME}}"
  }
});

export const productTheme: DesktopTheme = productTemplate.theme;
