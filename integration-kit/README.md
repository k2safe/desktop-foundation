# Desktop Foundation Integration Kit

这套材料交给任何产品项目的 AI 或工程师使用。目标是让产品项目通过已发布的 `@desktop-foundation/*` 包接入底座，而不是复制或改底座源码。

## 使用顺序

1. 先读 `ai-task.md`，确认接入目标、可改文件和禁止事项。
2. 按 `file-map.md` 找到产品项目里应该新增或迁移的文件。
3. 用 `minimal-migration-diff.md` 作为最小改造骨架。
4. 对照 `acceptance-checklist.md` 验收。
5. 遇到边界不清时看 `boundaries.md`，先判断应该在产品侧做，还是需要回到底座新增通用能力。

## 接入原则

- 产品项目只提供品牌、菜单、路由、业务页面、接口封装和业务状态。
- 底座只提供 shell、主题 token、通用组件、bridge、Tauri 能力、更新能力和 CI 封装。
- 视觉模板是轻量能力：产品选择模板和 token；不要为了单个产品把底座组件改成业务专用。
- 宽表格、长菜单、长弹窗必须在自己的容器内滚动，不能把整个窗口撑坏。
- 所有发布、更新、签名、公证细节都由产品仓库决定，底座只封装可调用能力。

## 标准输出

完成接入后，产品仓库至少应该有：

- `src/product-adapter.tsx`
- `src/theme.ts`
- `src/menus.tsx`
- `src/api/client.ts`
- `src/pages/*`
- `src-tauri/Cargo.toml`
- `src-tauri/capabilities/default.json`
- `package.json` scripts: `type-check`、`build`，可选 `visual:regression`、`package:desktop`、`release:desktop`

## 验证命令

```bash
pnpm exec desktop-foundation doctor --report artifacts/foundation-doctor.json
pnpm build
```

有桌面构建环境时再跑：

```bash
pnpm package:desktop
```
