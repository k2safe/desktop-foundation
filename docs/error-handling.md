# Error Handling

桌面底座提供统一错误形状和默认页面级错误边界。目标是让 HTTP 错误、业务错误码、网络错误、未授权、配置拦截和 React render error 都进入同一套处理路径。

## DesktopError

`@desktop-foundation/bridge` 导出：

```ts
import { DesktopError, normalizeDesktopError } from "@desktop-foundation/bridge";
```

标准字段：

```ts
interface DesktopErrorShape {
  code: string;
  message: string;
  status?: number;
  requestId?: string;
  details?: unknown;
  kind?: DesktopErrorKind;
  retryable?: boolean;
}
```

`kind` 用于 UI 和日志分类：

- `network`
- `timeout`
- `unauthorized`
- `forbidden`
- `not-found`
- `validation`
- `rate-limited`
- `server`
- `blocked`
- `configuration`
- `business`
- `unknown`

`retryable` 默认对 `network`、`timeout`、`rate-limited`、`server` 为 `true`，其余为 `false`，产品可以在服务端 payload 里返回 `retryable` 覆盖。

## HTTP 标准化

底座 transport 会自动处理：

- `fetch` 失败 -> `DesktopError { code: "NETWORK_ERROR", kind: "network" }`
- 超时/abort -> `DesktopError { code: "TIMEOUT", kind: "timeout" }`
- HTTP `401` -> `UnauthorizedError`
- HTTP `403/404/422/429/5xx` -> 对应 `kind`
- 业务 payload 非成功 code -> `DesktopError`

支持的业务 payload 形状：

```json
{
  "code": "ORDER_LOCKED",
  "message": "订单已锁定",
  "kind": "business",
  "retryable": false,
  "requestId": "req_123",
  "details": {}
}
```

如果 payload 是成功 code，底座仍保持原有约定，返回 `payload.data`：

```json
{ "code": 200, "data": {} }
```

## useRequest / useMutation

`@desktop-foundation/app-shell` 的 `useRequest` 和 `useMutation` 会把任何 caught value 转成 `DesktopError`：

```tsx
const request = useRequest(() => client.http.get<Order[]>("/orders"), {
  immediate: true,
  onError: (error) => {
    toast.notify({ title: error.message, tone: error.retryable ? "warning" : "danger" });
  }
});

if (request.error?.kind === "unauthorized") {
  return <LoginExpired />;
}
```

业务自己写 `try/catch` 时，也用 `normalizeDesktopError`：

```ts
try {
  await submit();
} catch (caught) {
  const error = normalizeDesktopError(caught);
  reportError(error);
}
```

## Error Boundary

`DesktopAppShell` 默认启用 `DesktopErrorBoundary`，会捕获 React render error 并展示底座默认错误 UI：

```tsx
<DesktopAppShell theme={theme} client={clientConfig}>
  <Routes />
</DesktopAppShell>
```

产品可以接入上报：

```tsx
<DesktopAppShell
  theme={theme}
  client={clientConfig}
  errorBoundary={{
    onError: (error, info) => {
      reportError({ code: error.code, message: error.message, stack: info.componentStack });
    }
  }}
>
  <Routes />
</DesktopAppShell>
```

自定义 fallback：

```tsx
<DesktopAppShell
  theme={theme}
  client={clientConfig}
  errorBoundary={{
    fallback: ({ error, reset }) => <ProductErrorView error={error} onRetry={reset} />
  }}
>
  <Routes />
</DesktopAppShell>
```

如果产品自己已经有边界，可以关闭底座默认边界：

```tsx
<DesktopAppShell theme={theme} client={clientConfig} errorBoundary={false}>
  <ProductOwnedBoundary>
    <Routes />
  </ProductOwnedBoundary>
</DesktopAppShell>
```

## 请求日志

`client.diagnostics.getRecentRequests()` 的错误项会包含：

```ts
{
  message: string;
  code?: string;
  status?: number;
  kind?: string;
  retryable?: boolean;
  requestId?: string;
}
```

`requestObserver.onUnauthorized` 和 `clientConfig.onUnauthorized` 仍会在 `401 / UNAUTHORIZED` 时触发。

## 边界

底座负责：

- 错误对象标准化
- HTTP/业务 code 分类
- request log 记录标准字段
- `useRequest` / `useMutation` 错误归一
- 页面级 render error fallback

产品负责：

- 服务端真实错误码规范
- 错误上报平台
- 业务错误文案和恢复动作
- 后端鉴权与审计
