# Product Onboarding Checklist

这份清单给任何接入桌面底座的产品项目使用。它不绑定具体业务，也不要求产品项目改底座源码。

## 1. 依赖

从 `artifacts/npm/foundation-packages.json` 复制 `consumer.dependencies`、`consumer.devDependencies` 和 `consumer.pnpm.overrides` 到接入项目。

当前推荐版本是 `0.1.13`。如果仓库里已有更新版本，以 `artifacts/npm/foundation-packages.json` 为准。

## 2. 样式入口

在前端入口引入共享样式：

```ts
import "@desktop-foundation/ui-react/styles.css";
```

## 3. 产品适配层

创建或迁移：

```text
src/product-adapter.tsx
src/menus.tsx
src/theme.ts
src/api/client.ts
```

产品只在这些文件里维护品牌、菜单、主题、布局模板、用户菜单、接口默认值和更新配置。不要为了业务视觉去改底座组件源码。

## 4. Shell 接入

根组件保持这个结构：

```tsx
<DesktopAppShell theme={adapter.theme} className={adapter.className} client={client}>
  <DesktopLayout
    variant={adapter.layout}
    brand={adapter.brand}
    menus={adapter.menus}
    user={adapter.user}
    userMenuItems={adapter.userMenuItems}
    topbarRight={adapter.topbarRight}
  >
    {businessPages}
  </DesktopLayout>
</DesktopAppShell>
```

## 5. Tauri 能力

检查：

```text
src-tauri/Cargo.toml
src-tauri/capabilities/default.json
src-tauri/tauri.conf.json
```

必须包含：

- `desktop-core-rs` 依赖
- `desktop-core:default` capability
- 产品自己的 bundle id、窗口大小、图标和打包信息

## 6. 更新能力

先接客户端配置，不强制接真实发布：

```bash
VITE_UPDATE_MANIFEST_URL=https://releases.example.com/app/latest.json
```

或：

```bash
VITE_UPDATE_GITHUB_REPO=owner/repo
```

发布链路可以后补，但客户端要能显示检查、下载、失败、完成等状态。

## 7. 验收命令

```bash
pnpm exec desktop-foundation doctor --report artifacts/foundation-doctor.json
pnpm build
pnpm exec desktop-foundation-ci --integration-check --integration-summary
```

收口阶段再跑 `pnpm exec desktop-foundation doctor --strict --report artifacts/foundation-doctor.json`，把 warn 清掉或明确说明。

有桌面构建环境时再跑：

```bash
pnpm package:desktop
```

## 8. 不要做的事

- 不要把产品名称、接口地址、业务角色写进底座仓库。
- 不要在接入项目里复制一份底座组件源码再改。
- 不要为了单个页面把 `DesktopLayout`、`Modal`、`Table` 的基础 CSS 改成业务专用。
- 不要跳过 `pnpm.overrides`，否则远程 tarball 依赖容易漂移。

## 9. 交付标准

- `doctor` 没有 fail。
- `pnpm build` 通过。
- 登录页、主 shell、表单、表格、弹窗、抽屉、用户菜单和更新状态都能打开。
- 长菜单和长页面互不抢滚动。
- 宽表格在页面、弹窗和抽屉里只在自己的容器内横向滚动。
