# @desktop-foundation/app-shell

应用级桌面壳。

这个包负责组合 `ui-react` 和 `bridge`，让产品入口更薄：

- `ThemeProvider`
- `ToastProvider`
- `ConfirmProvider`
- `DesktopClientProvider`
- `SessionProvider`
- `DesktopLoginPage`
- `PermissionGuard`
- `FeatureGuard`
- `DebugPanel`
- `useRequest`
- `useMutation`

## Usage

```tsx
import "@desktop-foundation/ui-react/styles.css";
import { DesktopAppShell } from "@desktop-foundation/app-shell";

export function App() {
  return (
    <DesktopAppShell
      theme={theme}
      client={{
        product: "product",
        apiBaseURL: "https://api.example.com"
      }}
    >
      <Routes />
    </DesktopAppShell>
  );
}
```

## Boundary

`app-shell` 可以管理应用级 provider 和 session 生命周期。

`app-shell` 不负责：

- 具体登录接口
- 具体用户模型
- 具体路由库
- 具体权限模型
- 具体菜单生成规则

## Standard Login

`DesktopLoginPage` pairs `LoginShell` with `useLogin` and `SessionProvider`.

The foundation owns the login template, control spacing, submit state, and session handoff. Product apps own brand content, copy, business fields, and the login API.

```tsx
import { DesktopLoginPage } from "@desktop-foundation/app-shell";
import { Input } from "@desktop-foundation/ui-react";

<DesktopLoginPage
  template="brand-panel"
  brand={{ name: "Product Desktop", logo: <Logo /> }}
  title="管理端登录"
  subtitle="使用产品账号进入桌面工作台。"
  accountLabel="账号"
  passwordLabel="密码"
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

Use `template` for built-in login layouts such as `split`, `brand-panel`, `center-card`, and `workbench`. A product can also pass a light template object for one-off copy and layout defaults. Use `extraFields` for product-specific fields such as OTP, tenant code, region, or invite token. Keep those fields in the product payload type; the shell only provides the slot and state helpers.

## Guards

- `AuthGuard`: authenticated route/content guard.
- `PermissionGuard`: permission list guard.
- `FeatureGuard`: feature flag guard.

## Debug

`DebugPanel` shows recent requests, session state, and runtime information using `desktop-bridge` diagnostics.
