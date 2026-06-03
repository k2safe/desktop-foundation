# File Map

## 产品仓库新增或迁移

| 文件 | 归属 | 说明 |
| --- | --- | --- |
| `src/product-adapter.tsx` | 产品 | 品牌、菜单、用户菜单、布局模板、主题、client 默认值、更新配置 |
| `src/theme.ts` | 产品 | 选择底座主题预设，覆盖少量 token |
| `src/menus.tsx` | 产品 | 产品菜单结构、图标、路由 key |
| `src/api/client.ts` | 产品 | API base URL、auth、transport、业务 request wrapper |
| `src/App.tsx` | 产品 | 接入 `DesktopAppShell` 和 `DesktopLayout` |
| `src/pages/*` | 产品 | 业务页面，使用底座组件承载表格、表单、弹窗 |
| `src-tauri/Cargo.toml` | 产品 | 引入 `desktop-core-rs`，保留产品自己的 Tauri 配置 |
| `src-tauri/capabilities/default.json` | 产品 | 引入 `desktop-core:default`，再追加产品自己的 capability |
| `.github/workflows/*` | 产品 | 可选，调用底座 CI wrapper，但发布策略由产品决定 |

## 公开依赖入口

| 包 | 用途 |
| --- | --- |
| `@desktop-foundation/ui-react` | 组件、布局、主题类型、样式入口 |
| `@desktop-foundation/app-shell` | 应用 provider、session、反馈、确认框、client 注入 |
| `@desktop-foundation/bridge` | HTTP、storage、secure storage、文件、桌面能力、更新能力 |
| `@desktop-foundation/theme-presets` | 通用主题模板和 token 预设 |
| `@desktop-foundation/create-desktop-app` | scaffold、doctor、CI wrapper |
| `desktop-core-rs` | Tauri command runtime |

## 不要放进产品仓库

```text
packages/desktop-ui-react/src
packages/desktop-bridge/src
packages/desktop-app-shell/src
packages/theme-presets/src
crates/desktop-core-rs/src
desktop-core-rs/src
src/@desktop-foundation
src/desktop-foundation
```

如果产品需要底座新增通用组件或模板，应该在底座仓库开一个通用能力变更；如果只是产品自己的业务表现，放在产品侧页面或 token/className 覆盖里。
