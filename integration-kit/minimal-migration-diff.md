# Minimal Migration Diff Template

这不是可以直接套用的 patch，而是一份最小改造骨架。产品项目的 AI 应按实际路径和版本替换占位符。

## 1. 依赖

```diff
diff --git a/package.json b/package.json
@@
   "dependencies": {
+    "@desktop-foundation/app-shell": "<FOUNDATION_PACKAGE_SPEC>",
+    "@desktop-foundation/bridge": "<FOUNDATION_PACKAGE_SPEC>",
+    "@desktop-foundation/theme-presets": "<FOUNDATION_PACKAGE_SPEC>",
+    "@desktop-foundation/ui-react": "<FOUNDATION_PACKAGE_SPEC>"
   },
   "devDependencies": {
+    "@desktop-foundation/create-desktop-app": "<FOUNDATION_PACKAGE_SPEC>"
   },
+  "pnpm": {
+    "overrides": {
+      "@desktop-foundation/app-shell": "<FOUNDATION_PACKAGE_SPEC>",
+      "@desktop-foundation/bridge": "<FOUNDATION_PACKAGE_SPEC>",
+      "@desktop-foundation/theme-presets": "<FOUNDATION_PACKAGE_SPEC>",
+      "@desktop-foundation/ui-react": "<FOUNDATION_PACKAGE_SPEC>",
+      "@desktop-foundation/create-desktop-app": "<FOUNDATION_PACKAGE_SPEC>"
+    }
+  }
```

## 2. 样式入口

```diff
diff --git a/src/main.tsx b/src/main.tsx
@@
+import "@desktop-foundation/ui-react/styles.css";
 import { createRoot } from "react-dom/client";
 import { App } from "./App";
```

## 3. 产品适配层

```diff
diff --git a/src/product-adapter.tsx b/src/product-adapter.tsx
new file mode 100644
@@
+import type { DesktopClientConfig } from "@desktop-foundation/bridge";
+import type { DesktopLayoutBrand, DesktopMenuItem, DesktopUser } from "@desktop-foundation/ui-react";
+import { createThemeTemplateRuntime } from "@desktop-foundation/theme-presets";
+
+const templateRuntime = createThemeTemplateRuntime({ initialTemplateId: "foundation-sidebar" });
+
+export const productAdapter = {
+  productId: "<product-id>",
+  appName: "<Product Desktop>",
+  layout: templateRuntime.layout,
+  theme: templateRuntime.theme,
+  className: templateRuntime.className,
+  brand: { name: "<Product Desktop>" } satisfies DesktopLayoutBrand,
+  user: { name: "<User>", role: "<Role>" } satisfies DesktopUser,
+  menus: [] satisfies DesktopMenuItem[],
+  clientDefaults: {
+    product: "<product-id>",
+    apiBaseURL: import.meta.env.VITE_API_BASE_URL ?? "https://api.example.com",
+    tokenKey: "<product-token-key>"
+  } satisfies Pick<DesktopClientConfig, "product" | "apiBaseURL" | "tokenKey">
+};
```

## 4. 根组件

```diff
diff --git a/src/App.tsx b/src/App.tsx
@@
+import { DesktopAppShell } from "@desktop-foundation/app-shell";
+import { DesktopLayout } from "@desktop-foundation/ui-react";
+import { productAdapter } from "./product-adapter";
+import { client } from "./api/client";
+
 export function App() {
   return (
+    <DesktopAppShell theme={productAdapter.theme} className={productAdapter.className} client={client}>
+      <DesktopLayout
+        variant={productAdapter.layout}
+        brand={productAdapter.brand}
+        menus={productAdapter.menus}
+        user={productAdapter.user}
+        userMenuItems={productAdapter.userMenuItems}
+      >
+        <ProductRoutes />
+      </DesktopLayout>
+    </DesktopAppShell>
   );
 }
```

## 5. Tauri capability

```diff
diff --git a/src-tauri/capabilities/default.json b/src-tauri/capabilities/default.json
@@
   "permissions": [
+    "desktop-core:default"
   ]
```

## 6. 验收

```bash
pnpm exec desktop-foundation doctor --report artifacts/foundation-doctor.json
pnpm build
```
