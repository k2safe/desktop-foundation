# Product Integration Example

这是一份通用产品接入示例。它只展示底座接入方式，不绑定任何具体业务项目。把占位符替换成产品仓库自己的名称、接口、菜单和页面即可。

## 目标结构

```text
src/main.tsx
src/App.tsx
src/product-adapter.tsx
src/theme.ts
src/menus.tsx
src/api/client.ts
src/pages/DashboardPage.tsx
src/pages/RecordsPage.tsx
src-tauri/Cargo.toml
src-tauri/capabilities/default.json
```

## 入口

```tsx
import "@desktop-foundation/ui-react/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

## 产品适配层

```tsx
import { createGitHubReleasesUpdateConfig, type DesktopClientConfig } from "@desktop-foundation/bridge";
import type { DesktopLayoutBrand, DesktopMenuItem, DesktopUser, DesktopUserMenuItem } from "@desktop-foundation/ui-react";
import { createThemeTemplateRuntime } from "@desktop-foundation/theme-presets";
import { LayoutDashboard, LogOut, Settings, UserRound } from "lucide-react";

const templateRuntime = createThemeTemplateRuntime({ initialTemplateId: "foundation-sidebar" });

export const productAdapter = {
  productId: "product-desktop",
  appName: "Product Desktop",
  layout: templateRuntime.layout,
  theme: templateRuntime.theme,
  className: templateRuntime.className,
  brand: {
    name: "Product Desktop"
  } satisfies DesktopLayoutBrand,
  user: {
    name: "Operator",
    role: "Operations"
  } satisfies DesktopUser,
  menus: [
    { id: "dashboard", label: "工作台", icon: <LayoutDashboard size={18} />, href: "/" },
    { id: "records", label: "记录列表", icon: <Settings size={18} />, href: "/records" }
  ] satisfies DesktopMenuItem[],
  userMenuItems: [
    { id: "profile", label: "个人信息", icon: <UserRound size={16} />, onSelect: () => window.dispatchEvent(new Event("product:profile")) },
    { id: "logout", label: "退出登录", icon: <LogOut size={16} />, danger: true, onSelect: () => window.dispatchEvent(new Event("product:logout")) }
  ] satisfies DesktopUserMenuItem[],
  clientDefaults: {
    product: "product-desktop",
    apiBaseURL: import.meta.env.VITE_API_BASE_URL ?? "https://api.example.com",
    tokenKey: "product.desktop.token"
  } satisfies Pick<DesktopClientConfig, "product" | "apiBaseURL" | "tokenKey">,
  updateConfig: createGitHubReleasesUpdateConfig({
    repository: import.meta.env.VITE_UPDATE_GITHUB_REPO ?? "owner/repository",
    currentVersion: import.meta.env.VITE_APP_VERSION ?? "0.0.0",
    channel: import.meta.env.VITE_UPDATE_CHANNEL ?? "stable",
    requireChecksumVerification: true
  })
};
```

## Client

```ts
import { createDesktopClient } from "@desktop-foundation/bridge";
import { productAdapter } from "../product-adapter";

export const client = createDesktopClient({
  ...productAdapter.clientDefaults,
  updateConfig: productAdapter.updateConfig,
  security: {
    allowedRequestOrigins: [new URL(productAdapter.clientDefaults.apiBaseURL).host],
    allowedExternalSchemes: ["https"],
    allowedDownloadDirectories: ["/tmp"]
  }
});
```

## App Shell

```tsx
import { DesktopAppShell } from "@desktop-foundation/app-shell";
import { DesktopLayout } from "@desktop-foundation/ui-react";
import { client } from "./api/client";
import { productAdapter } from "./product-adapter";
import { DashboardPage } from "./pages/DashboardPage";
import { RecordsPage } from "./pages/RecordsPage";

export function App() {
  const path = window.location.pathname;
  const page = path === "/records" ? <RecordsPage /> : <DashboardPage />;

  return (
    <DesktopAppShell theme={productAdapter.theme} className={productAdapter.className} client={client}>
      <DesktopLayout
        variant={productAdapter.layout}
        brand={productAdapter.brand}
        menus={productAdapter.menus}
        user={productAdapter.user}
        userMenuItems={productAdapter.userMenuItems}
      >
        {page}
      </DesktopLayout>
    </DesktopAppShell>
  );
}
```

## 表格页面

```tsx
import { DataTable, PageHeader, StatusTag } from "@desktop-foundation/ui-react";

type RecordRow = {
  id: string;
  owner: string;
  status: "success" | "processing";
  amount: string;
  createdAt: string;
};

const rows: RecordRow[] = [
  { id: "REC-001", owner: "Team A", status: "success", amount: "128.50", createdAt: "2026-06-03 10:00" },
  { id: "REC-002", owner: "Team B", status: "processing", amount: "256.00", createdAt: "2026-06-03 10:30" }
];

export function RecordsPage() {
  return (
    <>
      <PageHeader title="记录列表" description="产品项目维护自己的字段、筛选和业务动作。" />
      <DataTable<RecordRow>
        title="记录"
        description="宽表格由 DataTable 内部容器横向滚动。"
        columns={[
          { key: "id", header: "记录号", minWidth: 160, render: (row) => row.id },
          { key: "owner", header: "负责人", minWidth: 160, render: (row) => row.owner },
          { key: "status", header: "状态", minWidth: 140, render: (row) => <StatusTag status={row.status} tone={row.status === "success" ? "success" : "warning"} /> },
          { key: "amount", header: "金额", minWidth: 140, align: "right", render: (row) => row.amount },
          { key: "createdAt", header: "创建时间", minWidth: 220, render: (row) => row.createdAt }
        ]}
        rows={rows}
        rowKey="id"
      />
    </>
  );
}
```

`DataTable` 会把宽表格限制在自己的横向滚动容器里。产品如果必须使用原生 `table`，也要加同等的 overflow 包裹，避免弹窗和页面被撑宽。

## Tauri

`src-tauri/Cargo.toml` 需要引入底座 runtime：

```toml
[dependencies]
desktop-core-rs = { version = "0.1", features = ["tauri"] }
```

`src-tauri/capabilities/default.json` 至少包含：

```json
{
  "permissions": ["desktop-core:default"]
}
```

产品自己的窗口大小、bundle id、图标、签名、公证和发布上传策略仍在产品仓库维护。

## 验收

```bash
pnpm exec desktop-foundation doctor --report artifacts/foundation-doctor.json
pnpm build
```

有桌面构建环境时：

```bash
pnpm package:desktop
```
