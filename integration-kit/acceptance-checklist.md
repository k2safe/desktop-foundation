# Acceptance Checklist

## 基础契约

- [ ] `package.json` 里所有 `@desktop-foundation/*` 依赖版本一致。
- [ ] 远程 tarball 依赖已同步写入 `pnpm.overrides`。
- [ ] 前端入口引入 `@desktop-foundation/ui-react/styles.css`。
- [ ] 根组件使用 `DesktopAppShell`。
- [ ] 主界面使用 `DesktopLayout` 或底座提供的等价 layout 模板。
- [ ] 产品配置集中在 `src/product-adapter.tsx`。

## UI 与模板

- [ ] 选择了一个 layout 模板：侧边栏、顶部菜单或紧凑模板。
- [ ] 选择了一个登录页模板，或明确由产品完全自定义登录页。
- [ ] 表单、表格、弹窗、抽屉使用底座组件或遵守同样的 token 和滚动规则。
- [ ] 产品只覆盖 token、模板选择和少量 className，不改底座组件源码。
- [ ] 长菜单只在侧边栏内部滚动。
- [ ] 长页面只在内容区域滚动。
- [ ] 宽表格不拉伸页面、弹窗或抽屉，只在表格容器内横向滚动。

## 桌面能力

- [ ] `src-tauri/Cargo.toml` 包含 `desktop-core-rs`。
- [ ] `src-tauri/capabilities/default.json` 包含 `desktop-core:default`。
- [ ] bundle id、窗口大小、图标和应用名由产品项目配置。
- [ ] 更新能力在客户端可见：检查、无更新、有更新、下载中、下载完成、失败状态。

## CI 与发布

- [ ] `pnpm exec desktop-foundation doctor --report artifacts/foundation-doctor.json` 无 fail。
- [ ] `pnpm build` 通过。
- [ ] 有视觉基线的项目跑 `pnpm visual:regression`。
- [ ] 有桌面环境的项目跑 `pnpm package:desktop`。
- [ ] 产物、checksum、manifest、release plan 能由产品仓库自行上传。

## 禁止项

- [ ] 产品仓库没有复制底座源码目录。
- [ ] 产品代码没有从 `@desktop-foundation/*/src/*` 导入。
- [ ] 底座文档和底座包没有写入具体产品名、业务接口、业务角色或权限编码。
