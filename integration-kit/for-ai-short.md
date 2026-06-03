# Short AI Handoff

把下面这段直接发给产品项目的 AI：

```text
请把当前产品项目接入 desktop-foundation 0.1.18。

先读这些文件：
- integration-kit/ai-task.md
- integration-kit/file-map.md
- integration-kit/minimal-migration-diff.md
- integration-kit/acceptance-checklist.md
- docs/doctor.md

只改产品项目，不要改 desktop-foundation 底座源码。
不要复制 packages/desktop-ui-react/src、packages/desktop-bridge/src、packages/desktop-app-shell/src、packages/theme-presets/src、desktop-core-rs/src。
不要从 @desktop-foundation/*/src/* 内部路径导入。

产品配置统一放到 src/product-adapter.tsx：品牌、菜单、主题模板、布局模板、用户菜单、client 默认值、更新配置。
根组件使用 DesktopAppShell + DesktopLayout。
样式入口必须引入 @desktop-foundation/ui-react/styles.css。
表格优先用 DataTable/Table/EditableTable；宽表格只在自己的容器横向滚动。
弹窗和抽屉里的长内容只在弹窗/抽屉 body 内滚动。
Tauri 项目必须接 desktop-core-rs 和 desktop-core:default capability。

如果产品需要请求任意第三方链接，必须走 client.linkProxy；本地/VPN/内网代理网关可以配 VITE_LINK_PROXY_URL，并用 VITE_LINK_PROXY_ORIGINS 显式允许代理网关。不要在业务页面直接 fetch/axios 请求第三方绝对 URL。

自动更新默认先接发现新版本、下载更新包、校验 size/sha256。不要在业务项目里自己写替换 .app、安装后重启等逻辑；需要真实安装时，产品安装并注册 Tauri updater 插件，打开 VITE_TAURI_UPDATER=1，UI 仍只调用 client.updates.installUpdate。

完成后运行：
pnpm exec desktop-foundation doctor --report artifacts/foundation-doctor.json
pnpm build

如果 doctor 有 fail 必须修。
如果 doctor 有 warn，请按 docs/doctor.md 逐项说明：已修、可接受原因、或后续计划。
```
