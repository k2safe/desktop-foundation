# Short AI Handoff

把下面这段直接发给产品项目的 AI：

```text
请把当前产品项目接入 desktop-foundation。
不要写死旧版本号；稳定接入优先读取 release package manifest，并以 manifest 里的 consumer 依赖块为准：
https://github.com/k2safe/desktop-foundation/releases/download/v0.1.21/foundation-packages.json

如果明确要追 main 上的最新底座，才使用 development manifest：
https://raw.githubusercontent.com/k2safe/desktop-foundation/main/artifacts/npm/foundation-packages.json

先读这些文件：
- integration-kit/ai-task.md
- integration-kit/file-map.md
- integration-kit/minimal-migration-diff.md
- integration-kit/acceptance-checklist.md
- docs/doctor.md
- docs/package-consumption.md
- docs/api-reference.md

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

如果产品需要上传文件，浏览器/Tauri UI 里直接传 FormData 给 client.http.post；不要手动设置 multipart/form-data 的 Content-Type。Node/headless smoke 里使用 createDesktopClient 时必须显式传 session、storage、secureStorage、desktop、files adapter 或 noop adapter，因为默认 web adapter 会访问 window/localStorage。

自动更新默认先接发现新版本、下载更新包、校验 size/sha256。不要在业务项目里自己写替换 .app、安装后重启等逻辑；需要真实安装时，产品安装并注册 Tauri updater 插件，打开 VITE_TAURI_UPDATER=1，UI 仍只调用 client.updates.installUpdate。

完成后运行：
pnpm exec desktop-foundation-ci --integration-check --integration-report artifacts/foundation-integration.json
pnpm build

如果 integration-check 有 fail 必须修。
如果 integration-check 有 warn，请按 docs/doctor.md 逐项说明：已修、可接受原因、或后续计划。
```
