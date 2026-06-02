import type { DesktopTheme } from "@desktop-foundation/ui-react";
import { createThemeTemplateRuntime } from "@desktop-foundation/theme-presets";

export const productTemplate = createThemeTemplateRuntime("{{THEME_TEMPLATE_ID}}", {
  id: "{{PRODUCT_ID}}",
  brand: {
    name: "{{APP_NAME}}"
  }
});

export const productTheme: DesktopTheme = productTemplate.theme;
