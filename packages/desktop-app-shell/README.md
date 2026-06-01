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

## Guards

- `AuthGuard`: authenticated route/content guard.
- `PermissionGuard`: permission list guard.
- `FeatureGuard`: feature flag guard.

## Debug

`DebugPanel` shows recent requests, session state, and runtime information using `desktop-bridge` diagnostics.
