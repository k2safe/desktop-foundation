# Product Integration Guide

This guide is the handoff checklist for product repositories that consume `desktop-foundation`.

The foundation owns reusable desktop infrastructure: UI shell, layout templates, theme tokens, common components, request/session bridge, Tauri command contracts, release/update helpers, and CI wrappers.

The product app owns business data, API paths, routing, permission semantics, copy, brand assets, and page-level workflows.

## 1. Install Foundation Packages

Before a registry publish is available, install from the GitHub raw tarballs listed in:

```text
https://raw.githubusercontent.com/k2safe/desktop-foundation/main/artifacts/npm/foundation-packages.json
```

Fast path:

1. Open the manifest.
2. Copy `consumer.dependencies`, `consumer.devDependencies`, and `consumer.pnpm.overrides` into the product `package.json`.
3. Run `pnpm install`.

The product should import the shared stylesheet once:

```tsx
import "@desktop-foundation/ui-react/styles.css";
```

## 2. Add Theme Template Runtime

Use a template first, then override product-specific brand and tokens.

```ts
import { createThemeTemplateRuntime } from "@desktop-foundation/theme-presets";

export const productTemplate = createThemeTemplateRuntime("admin", {
  brand: { name: "CoinPay" },
  colors: {
    primary: "#3b00f5",
    primaryHover: "#2700c7"
  }
});
```

Use `productTemplate.theme` for `DesktopAppShell`, `productTemplate.layout.appShell` for `DesktopLayout`, and `productTemplate.layout.login` for `DesktopLoginPage`.

## 3. Wrap The App

```tsx
import { DesktopAppShell } from "@desktop-foundation/app-shell";
import { DesktopLayout } from "@desktop-foundation/ui-react";
import { productTemplate } from "./theme";

export function App() {
  return (
    <DesktopAppShell
      theme={productTemplate.theme}
      client={{
        product: "coinpay-admin",
        apiBaseURL: "https://api.example.com"
      }}
    >
      <DesktopLayout
        variant={productTemplate.layout.appShell}
        brand={{ name: "CoinPay", logo: <Logo /> }}
        menus={menus}
        user={session.user}
      >
        <Routes />
      </DesktopLayout>
    </DesktopAppShell>
  );
}
```

## 4. Use The Foundation Login Page

The login layout belongs in the foundation. Product apps should pass brand, copy, API logic, and any extra business fields.

```tsx
import { DesktopLoginPage } from "@desktop-foundation/app-shell";
import { Input } from "@desktop-foundation/ui-react";
import { productTemplate } from "./theme";

interface LoginPayload {
  account: string;
  password: string;
  remember?: boolean;
  otp?: string;
}

<DesktopLoginPage
  brand={{ name: "CoinPay", logo: <Logo /> }}
  title="管理端登录"
  subtitle="商户、链资产、钱包流水和权限配置统一在桌面端处理。"
  variant={productTemplate.layout.login}
  accountLabel="管理员账号"
  passwordLabel="登录密码"
  extraFields={({ payload, setField }) => (
    <Input
      label="Google 验证码"
      placeholder="未开启时可留空"
      value={payload.otp ?? ""}
      onChange={(event) => setField("otp", event.target.value)}
    />
  )}
  login={{
    defaultPayload: { account: "admin", password: "", remember: true },
    login: async (client, payload: LoginPayload) => {
      return client.request("/admin/login", {
        method: "POST",
        body: payload
      });
    }
  }}
/>
```

Use `extraFields` for OTP, tenant code, invite token, or environment selection. Do not fork foundation login internals for product fields.

## 5. Add Desktop Core For Tauri

In the product `src-tauri/Cargo.toml`:

```toml
desktop-core-rs = { git = "ssh://git@github.com/k2safe/desktop-foundation.git", branch = "main", package = "desktop-core-rs", features = ["tauri"] }
```

Wire foundation commands in the product Tauri entrypoint according to the current `desktop-core-rs` API, then expose only the capabilities the product needs in `src-tauri/capabilities/default.json`.

## 6. Product Responsibilities

Product code should provide:

- routes and page components
- business API client wrappers
- domain table columns and form schemas
- auth payload and session user shape
- permission checks and menu visibility rules
- release URL, updater manifest URL, and signing policy

Foundation code should provide:

- component and layout primitives
- theme templates and visual density
- login shell and product field slots
- desktop bridge transport
- secure storage, file, notification, update, and CI adapters

## 7. Validate

Run these checks in the product repo after integration:

```bash
pnpm install
pnpm build
pnpm visual:regression
pnpm tauri build
```

If the product does not use Playwright baselines yet, `pnpm visual:regression` can be added later. Keep `pnpm build` and the desktop build green before starting business-page migration.
