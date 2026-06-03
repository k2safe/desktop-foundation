# Login Templates

Desktop login is a light template capability. The foundation owns layout rhythm, states, and common fields; product projects own brand, copy, business-only fields, authentication, and final theme overrides.

## Built-in Templates

```ts
type DesktopLoginTemplateId = "split" | "brand-panel" | "center-card" | "workbench";
```

| Template | Layout | Use when |
| --- | --- | --- |
| `split` | left form, right visual | general desktop products that need a clear brand/content split |
| `brand-panel` | larger brand panel, stronger visual side | admin or operations products that need a stronger first impression |
| `center-card` | centered compact card | utility tools, internal apps, or products with minimal login copy |
| `workbench` | right-side form, dark workbench visual | monitoring, command, or dense operations products |

Theme templates still expose `template.layout.login`, so products can keep one source of truth for app shell and login layout.

## Basic Usage

```tsx
import { DesktopLoginPage } from "@desktop-foundation/app-shell";

<DesktopLoginPage
  template="brand-panel"
  brand={{ name: "Product Desktop" }}
  login={loginConfig}
/>
```

Existing code using `variant="brand-split"` remains valid. `template` is preferred for new products because it can provide default copy, visual text, labels, and variant together.

## Product Overrides

Every template field can be overridden by props:

```tsx
import { DesktopLoginPage } from "@desktop-foundation/app-shell";
import { Input } from "@desktop-foundation/ui-react";

<DesktopLoginPage
  template="workbench"
  brand={{ name: "Product Desktop" }}
  title="管理端登录"
  subtitle="使用产品账号进入桌面工作台。"
  accountLabel="账号"
  passwordLabel="密码"
  submitLabel="登录"
  extraFields={({ payload, setField }) => (
    <Input
      label="验证码"
      placeholder="未开启时可留空"
      value={payload.otp ?? ""}
      onChange={(event) => setField("otp", event.target.value)}
    />
  )}
  login={loginConfig}
/>
```

Business-only fields such as OTP, tenant code, region, invite token, or environment selection belong in `extraFields`. Do not fork `DesktopLoginPage` for product-specific fields.

## Custom Template Object

A product can pass a light template object without changing foundation internals:

```tsx
<DesktopLoginPage
  template={{
    id: "product-compact",
    variant: "centered",
    title: "Welcome back",
    subtitle: "Continue to the product workspace.",
    submitLabel: "Continue"
  }}
  brand={{ name: "Product Desktop" }}
  login={loginConfig}
/>
```

If the same custom shape is useful to multiple products, move it back into the foundation as a generic built-in template.
