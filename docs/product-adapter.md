# Product Adapter

`product-adapter` 是接入项目和桌面底座之间的薄适配层。它只承载产品自己的品牌、菜单、主题、用户、登录、权限、接口默认值和更新配置入口；底座组件、bridge、Tauri 能力不要在接入项目里改。

## 目标

- 接入项目只改产品侧配置，不改 `@desktop-foundation/*` 包。
- 菜单、主题、布局模板、用户菜单、接口默认值集中在一个文件。
- 业务页面可以自由实现，但 shell、表格、弹窗、更新、storage 等基础能力保持统一。

## 推荐文件

```text
src/product-adapter.tsx
src/menus.tsx
src/theme.ts
src/api/client.ts
src/pages/*
```

## 最小形态

```tsx
import type { ReactNode } from "react";
import type { DesktopClientConfig } from "@desktop-foundation/bridge";
import type {
  DesktopLayoutBrand,
  DesktopLayoutVariant,
  DesktopMenuItem,
  DesktopTheme,
  DesktopUser,
  DesktopUserMenuItem,
  LocaleCode,
  LocaleDictionary
} from "@desktop-foundation/ui-react";

export interface ProductAdapter {
  productId: string;
  appName: string;
  theme: DesktopTheme;
  locale: LocaleCode;
  messages?: LocaleDictionary;
  dictionaries?: Record<string, LocaleDictionary>;
  className: string;
  layout: DesktopLayoutVariant;
  brand: DesktopLayoutBrand;
  user: DesktopUser;
  menus: DesktopMenuItem[];
  userMenuItems?: DesktopUserMenuItem[];
  topbarRight?: ReactNode;
  clientDefaults: Pick<DesktopClientConfig, "product" | "apiBaseURL" | "tokenKey">;
}
```

## 接入边界

接入项目可以改：

- `productAdapter.brand`
- `productAdapter.menus`
- `productAdapter.user`
- `productAdapter.userMenuItems`
- `productAdapter.layout`
- `productAdapter.theme`
- `productAdapter.locale`
- `productAdapter.messages`
- `productAdapter.dictionaries`
- `productAdapter.clientDefaults`
- 业务页面、业务请求、业务状态管理

接入项目不要改：

- `@desktop-foundation/ui-react` 的组件源码
- `@desktop-foundation/app-shell` 的 shell/auth/session 源码
- `@desktop-foundation/bridge` 的 runtime/transport 源码
- `desktop-core-rs` 的基础命令
- Tauri ACL 里的 `desktop-core:default` 语义

## 验收

```bash
pnpm exec desktop-foundation doctor --report artifacts/foundation-doctor.json
pnpm build
```

`doctor` 只检查底座接入契约；业务 API、业务权限和业务数据正确性仍由接入项目自己验证。
