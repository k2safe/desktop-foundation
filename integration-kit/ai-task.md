# AI Task Book

你是产品项目的接入 AI。你的任务是把当前产品项目接入 desktop-foundation 底座。你只能改产品仓库，不要改底座仓库，也不要复制底座源码。

## 目标

- 使用 `@desktop-foundation/*` 包接入桌面 shell、主题、组件、bridge、更新和 CI 能力。
- 建立一个薄的 `src/product-adapter.tsx`，集中产品品牌、菜单、布局模板、用户菜单、主题、client 默认值和更新配置。
- 保留产品自己的业务页面、业务 API、业务权限和业务数据模型。
- 让 `desktop-foundation doctor` 无 fail；warn 可以逐项解释或补齐。

## 允许改的文件

- `package.json`、包管理锁文件、`pnpm.overrides`
- `src/main.tsx` 或等价前端入口
- `src/App.tsx` 或产品根组件
- `src/product-adapter.tsx`
- `src/theme.ts`
- `src/menus.tsx`
- `src/api/client.ts`
- `src/pages/*`
- `src-tauri/*` 的产品配置、capability、bundle 信息
- `.github/workflows/*` 的产品发布/验证流程

## 不允许改的内容

- 不要编辑 `node_modules/@desktop-foundation/*`。
- 不要在产品仓库复制 `packages/desktop-ui-react/src`、`packages/desktop-bridge/src`、`packages/desktop-app-shell/src`、`packages/theme-presets/src` 或 `desktop-core-rs/src`。
- 不要从 `@desktop-foundation/*/src/*` 这种内部路径导入。
- 不要把产品名称、接口域名、业务角色、权限编码写进底座文档或底座包源码。
- 不要为了一个业务页面修改底座的 `DesktopLayout`、`Modal`、`Drawer`、`Table`、`DataTable` 基础样式。

## 执行步骤

1. 读取产品项目的现有入口、路由、菜单、登录页、表格页、弹窗和 Tauri 配置。
2. 从底座发布清单复制依赖和 `pnpm.overrides`，保持所有 `@desktop-foundation/*` 版本一致。
3. 在前端入口引入 `@desktop-foundation/ui-react/styles.css`。
4. 新增或整理 `src/product-adapter.tsx`，把底座配置集中进去。
5. 用 `DesktopAppShell` 包住应用，用 `DesktopLayout` 承载菜单、顶部栏、用户菜单和业务页面。
6. 表格使用 `DataTable`、`Table` 或 `EditableTable`；如果业务必须用原生表格，要包在横向滚动容器里。
7. 弹窗和抽屉里的长内容要让 body 自己滚动，宽表格要让表格容器横向滚动。
8. 更新能力先接客户端 adapter；真实下载、安装、签名、公证由产品发布链路决定。
9. 运行 doctor、build、桌面打包命令，修到无 fail。

## 交付说明模板

```text
已接入 desktop-foundation：
- 依赖和 overrides 已对齐：<version or package source>
- 产品适配层：src/product-adapter.tsx
- Shell：DesktopAppShell + DesktopLayout
- 样式入口：@desktop-foundation/ui-react/styles.css
- Tauri 能力：desktop-core-rs + desktop-core:default
- 更新能力：<manifest/github/native adapter/mock>
- 验证：doctor <pass/warn/fail>, build <pass/fail>, package <pass/fail/not-run>

剩余产品侧事项：
- <business api/auth/data/permission/release signing items>
```
