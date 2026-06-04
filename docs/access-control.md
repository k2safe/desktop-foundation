# Access Control

桌面底座提供轻量访问控制能力，用于菜单、命令、设置分组、详情动作和页面守卫。它只处理通用判断与 UI 隐藏；真实权限来源、角色模型、接口鉴权仍归产品项目。

## App Shell 接入

`DesktopAppShell` 会把当前 session user 的 `permissions`、`role`、`roles` 和产品传入的 `accessControl` 合并成全局访问上下文：

```tsx
<DesktopAppShell
  theme={theme}
  client={client}
  accessControl={{
    features: {
      updates: true,
      diagnostics: true,
      reviewWorkbench: false
    }
  }}
  session={{ loadUser }}
>
  <Routes />
</DesktopAppShell>
```

session user 推荐包含：

```ts
{
  id: "u_1",
  role: "Operations",
  roles: ["operator"],
  permissions: ["orders:read", "orders:export", "settings:read"]
}
```

`accessControl.permissions` 和 `accessControl.roles` 可作为本地 demo 或特殊入口的附加授权；真实产品优先从登录态返回当前用户权限。

## 规则字段

支持这些可选字段：

```ts
{
  permission: "orders:read",
  permissions: ["orders:read", "orders:export"],
  permissionMode: "all",
  role: "admin",
  roles: ["admin", "operator"],
  roleMode: "any",
  feature: "updates",
  features: ["updates", "diagnostics"],
  featureMode: "all"
}
```

同一条规则中，权限、角色、功能开关三个维度之间是 `AND` 关系。每个维度内部默认 `all`，可用对应的 `*Mode: "any"` 改成任一命中。

也可以放到 `access` 字段里：

```ts
{ id: "orders", label: "订单中心", access: { permission: "orders:read", feature: "orders" } }
```

## 自动过滤

这些 UI 项会自动读取访问上下文并隐藏无权项：

- `DesktopLayout` 的 `menus`
- `DesktopLayout` 的 `userMenuItems`
- `CommandPalette` 的 `items`
- `SettingsPage` 的 `sections`
- `DetailDrawer` 的 `actions`

示例：

```tsx
const menus = [
  { id: "dashboard", label: "工作台" },
  { id: "orders", label: "订单中心", permission: "orders:read" },
  { id: "settings", label: "设置", permission: "settings:read" }
];

const commands = [
  { id: "export", label: "导出订单", permission: "orders:export" },
  { id: "review", label: "复核台", feature: "reviewWorkbench" }
];
```

父级菜单没有可见子项且自身没有 `href` 时会一起隐藏。

## 页面与按钮守卫

页面级使用 `AccessGuard`：

```tsx
import { AccessDeniedState, AccessGuard } from "@desktop-foundation/app-shell";

<AccessGuard permission="orders:read" fallback={<AccessDeniedState />}>
  <OrdersPage />
</AccessGuard>
```

按钮级可以继续使用兼容的 `PermissionGuard`：

```tsx
import { PermissionGuard } from "@desktop-foundation/app-shell";

<PermissionGuard permission="orders:export">
  <Button>导出</Button>
</PermissionGuard>
```

功能开关使用 `FeatureGuard`：

```tsx
<FeatureGuard feature="updates">
  <UpdateCenter />
</FeatureGuard>
```

旧写法仍可用：

```tsx
<FeatureGuard enabled={Boolean(flags.updates)}>
  <UpdateCenter />
</FeatureGuard>
```

## Hook

自定义业务组件可以直接使用 `useAccess()`：

```tsx
import { useAccess } from "@desktop-foundation/ui-react";

function ExportButton() {
  const { canAccess } = useAccess();
  if (!canAccess({ permission: "orders:export" })) return null;
  return <button type="button">导出</button>;
}
```

## 边界

底座负责：

- UI 层隐藏无权入口
- 页面/按钮守卫
- feature flag 的前端开关
- demo 和脚手架约定

产品负责：

- 登录后返回真实权限
- 后端接口鉴权
- 权限编码命名规范
- 角色和权限的映射关系
- 审计与安全告警
