# Short AI Handoff

把下面这段直接发给产品项目的 AI：

```text
请把当前产品项目接入 desktop-foundation 0.1.15。

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

完成后运行：
pnpm exec desktop-foundation doctor --report artifacts/foundation-doctor.json
pnpm build

如果 doctor 有 fail 必须修。
如果 doctor 有 warn，请按 docs/doctor.md 逐项说明：已修、可接受原因、或后续计划。
```
