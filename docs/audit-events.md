# Audit Events

底座提供一条轻量审计/诊断事件流，用来记录桌面端关键动作、失败原因和安全边界命中情况。它不是业务后端审计表的替代品，而是产品桌面端接入真实上报、排障和本地 DebugPanel 的统一入口。

## 事件来源

`createDesktopClient` 会自动记录这些底座能力：

- `desktop.openExternal`、`desktop.copyText`、`desktop.notify`、窗口标题和窗口状态变更
- `file.openDialog`、`file.saveDialog`、`file.writeText`、`file.exportJson`、`file.download`
- `update.check`、`update.download`、`update.install`、`update.openPage`
- `proxy.setConfig`、`proxy.clearConfig`、`proxy.testConnection`
- `linkProxy.open`、`linkProxy.request.failed`
- `http.request.failed`

`@desktop-foundation/app-shell` 会补充应用级事件：

- `auth.login.success`
- `auth.login.failed`
- `auth.logout`
- `auth.session.load.failed`
- `access.denied`

产品也可以主动写入事件：

```ts
client.diagnostics.recordAuditEvent({
  action: "orders.export.requested",
  ok: true,
  metadata: {
    count: selectedRows.length
  }
});
```

## 接入上报

真实业务接入时，在 client 边界配置 `onAuditEvent` 或 `auditObserver`，再把事件转发到产品自己的日志/审计服务：

```ts
import { createDesktopClient, type AuditEvent } from "@desktop-foundation/bridge";

function reportAuditEvent(event: AuditEvent) {
  navigator.sendBeacon("/audit/events", JSON.stringify(event));
}

export const client = createDesktopClient({
  product: "product-desktop",
  apiBaseURL: "https://api.example.com",
  onAuditEvent: reportAuditEvent,
  maxAuditEvents: 200
});
```

`onAuditEvent` 是同步回调。不要在里面抛错；如果上报服务不可用，产品应该自行降级或丢弃。

## 本地查看

DebugPanel 新增 `Audit` tab，会读取：

```ts
client.diagnostics.getRecentAuditEvents();
```

清空本地事件：

```ts
client.diagnostics.clearRecentAuditEvents();
```

这些事件只保存在当前 renderer 内存中，默认最多 100 条。关闭应用或刷新页面后不会保留。

## 事件结构

```ts
interface AuditEvent {
  id: string;
  timestamp: number;
  product?: string;
  namespace?: string;
  level: "info" | "warn" | "error";
  action: string;
  ok?: boolean;
  message?: string;
  target?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
  error?: {
    name?: string;
    message: string;
    code?: string;
    status?: number;
    kind?: string;
    retryable?: boolean;
    requestId?: string;
  };
}
```

建议产品只把必要的业务标识、数量、状态写进 `metadata`，不要记录密码、token、身份证号、完整文件内容或其它敏感数据。底座自动事件也会避免写入 token 和请求 body。

## 集成检查

`desktop-foundation-ci --integration-check` 会检测是否出现以下任一接入点：

- `onAuditEvent`
- `auditObserver`
- `recordAuditEvent`
- `getRecentAuditEvents`

没有检测到时会给出 `warn`，方便外部 AI 或工程师在真实业务上线前补上审计 sink。
