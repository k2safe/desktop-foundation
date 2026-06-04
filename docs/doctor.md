# Doctor Reference

`desktop-foundation doctor` 用来检查产品项目是否按底座契约接入。它不检查业务接口、业务权限或业务数据正确性，只检查底座接入边界。

## 常用命令

```bash
pnpm exec desktop-foundation doctor --report artifacts/foundation-doctor.json
pnpm exec desktop-foundation doctor --strict --report artifacts/foundation-doctor.json
pnpm exec desktop-foundation ci --integration-check --integration-summary
```

- `doctor` 默认会打印 next actions 摘要。
- `--report` 输出完整 JSON，适合发给底座维护者或另一个 AI。
- `--strict` 会在有 fail 或 warn 时退出失败，适合接入收口和 CI gate。
- `desktop-foundation-ci --integration-check` 默认只在 fail 时退出失败；加 `--summary` 或 `--integration-summary` 才打印分组摘要。
- 报告里的 `capabilities` 来自 [Foundation Capabilities](capabilities.md)，用于把 findings 聚合成产品能力矩阵。

## Report 结构

```json
{
  "summary": { "status": "warn", "pass": 36, "warn": 2, "fail": 0 },
  "stats": { "filesScanned": 16, "sourceFilesScanned": 9 },
  "nextActions": [{ "id": "script:visual:regression", "status": "warn", "action": "..." }],
  "capabilities": {
    "summary": { "status": "warn", "pass": 9, "warn": 5, "fail": 0 },
    "items": [{ "id": "updates", "status": "warn", "checks": [] }]
  },
  "findings": []
}
```

先看 `summary.fail`。fail 必须修；warn 可以按阶段处理，但接入收口时建议用 `--strict` 清干净。`capabilities.summary` 用来判断哪一类底座能力还没收口；具体怎么修仍然回到 `findings`。

## Findings

| ID | 级别 | 意思 | 修复方式 |
| --- | --- | --- | --- |
| `dependency:@desktop-foundation/bridge` | fail | 缺 bridge SDK。 | 从 `artifacts/npm/foundation-packages.json` 复制 `consumer.dependencies`。 |
| `dependency:@desktop-foundation/ui-react` | fail | 缺 UI 组件包。 | 同步底座依赖和 `pnpm.overrides`。 |
| `dependency:@desktop-foundation/app-shell` | fail | 缺应用 shell。 | 安装并在根组件使用 `DesktopAppShell`。 |
| `dependency:@desktop-foundation/theme-presets` | fail | 缺主题模板包。 | 安装并通过产品 adapter 选择模板。 |
| `dependency:@desktop-foundation/create-desktop-app` | warn | 缺 CLI/doctor 包。 | 加到 devDependencies，方便运行 doctor 和 CI wrapper。 |
| `foundation-version` | fail | 多个底座包版本不一致。 | 所有 `@desktop-foundation/*` 使用同一个版本或同一批 tarball。 |
| `pnpm-overrides:*` | warn | 远程 tarball 没有写入 overrides。 | 把依赖同值复制到 `package.json pnpm.overrides`。 |
| `ui-styles` | fail | 没有引入底座共享 CSS。 | 在前端入口加 `import "@desktop-foundation/ui-react/styles.css";`。 |
| `app-shell` | fail | 没检测到 `DesktopAppShell`。 | 根组件用 `DesktopAppShell` 包住产品页面。 |
| `theme-template` | fail | 没检测到主题模板 runtime。 | 在 `src/product-adapter.tsx` 或 `src/theme.ts` 使用 `createThemeTemplateRuntime`。 |
| `theme-template:id` | warn | 检测到未知模板 id。 | 使用内置模板 id，或明确传入完整自定义模板对象。 |
| `login-shell` | warn | 未使用底座登录页。 | 可接受：产品完全自定义登录页；否则用 `DesktopLoginPage`。 |
| `login-template` | warn | 使用了 `DesktopLoginPage`，但没有传 `template`。 | 用 `template.layout.login` 或内置登录模板 id，避免业务项目改底层登录结构。 |
| `product-adapter:file` | warn | 缺 `src/product-adapter.tsx`。 | 建一个薄 adapter，集中品牌、菜单、模板、用户菜单、client 默认值和更新配置。 |
| `product-adapter:usage` | warn | adapter 没被使用。 | 根组件、client 或 theme 从 `product-adapter` 读取配置，避免散落在业务页面。 |
| `foundation-source-copy` | warn | 产品仓库疑似复制了底座源码。 | 删除复制目录，改为消费 `@desktop-foundation/*` 包。 |
| `foundation-internal-import` | warn | 产品代码从底座内部路径导入。 | 改为从公开包入口导入，例如 `@desktop-foundation/ui-react`。 |
| `foundation-css-overrides` | warn | 产品 CSS 直接覆盖 `df-*` 底座内部选择器。 | 优先使用模板、theme token 或产品自有 wrapper class，不要大面积覆盖底座 class。 |
| `overflow:table` | warn | 表格没有明显局部滚动保护，或还没出现表格页面。 | 用 `DataTable`/`Table`/`EditableTable`，宽列设置 `minWidth`；原生表格必须包横向滚动容器。 |
| `overflow:overlay` | warn | 弹窗/抽屉没有明显滚动保护。 | 长内容放在 overlay body 内滚动，宽表格在内部横向滚动。 |
| `tauri-core` | fail/warn | Tauri 项目缺 `desktop-core-rs`，或不是 Tauri 项目。 | Tauri 项目在 `src-tauri/Cargo.toml` 引入 `desktop-core-rs`。 |
| `tauri-capability` | warn | Tauri ACL 缺 `desktop-core:default`。 | 在 `src-tauri/capabilities/default.json` 加 `desktop-core:default`。 |
| `updates` | warn | 没有更新配置入口。 | 在 client 里配置 `VITE_UPDATE_MANIFEST_URL` 或 `createGitHubReleasesUpdateConfig`。 |
| `updates:placeholder` | warn | 更新仓库或 URL 还在用占位值。 | 发布前替换成产品自己的 `VITE_UPDATE_*` 配置。 |
| `updates:install-boundary` | pass | 检测真实安装 adapter 是否在 client/native 边界接入。 | 未接 adapter 时，业务 UI 只展示发现、下载、校验状态；接入后也只调用 `client.updates.installUpdate`。 |
| `updates:install-bypass` | warn | 检测到疑似业务页面直接替换 `.app` 或重启。 | 删除业务侧安装/重启逻辑，统一放到底座/Tauri updater adapter。 |
| `link-proxy` | pass | 检测 link proxy 接入面。 | 需要请求任意第三方链接时，统一走 `client.linkProxy`。 |
| `link-proxy:gateway-policy` | warn | 配了代理网关但没配代理网关白名单。 | 本地/VPN/内网代理网关写到 `allowedLinkProxyOrigins` 或 `VITE_LINK_PROXY_ORIGINS`。 |
| `link-proxy:direct-policy` | warn | direct 模式缺目标白名单。 | direct 模式必须配 `allowedLinkTargetOrigins` 或 `VITE_LINK_TARGET_ORIGINS`。 |
| `link-proxy:bypass` | warn | 检测到业务代码直接请求外部绝对 URL。 | 任意第三方链接请求改走 `client.linkProxy`，产品自有 API 边界除外。 |
| `script:type-check` | fail | 缺类型检查脚本。 | package scripts 加 `type-check`。 |
| `script:build` | fail | 缺构建脚本。 | package scripts 加 `build`。 |
| `script:visual:regression` | warn | 缺视觉回归。 | 有 UI 基线的产品再加；早期接入可接受。 |
| `script:package:desktop` | warn | 缺桌面打包脚本。 | Tauri 产品加 `package:desktop`，调用 Tauri build 和底座 packaging wrapper。 |
| `script:release` | warn | 缺 release manifest 脚本。 | 接自动更新前补 `release:desktop` 或 `release:manifest`。 |

## 推荐接入节奏

1. 先修所有 fail，让 `summary.fail = 0`。
2. 再处理产品 adapter、overflow、updates 相关 warn。
3. 最后接视觉回归、桌面打包、release manifest。
4. 收口时跑 `pnpm exec desktop-foundation doctor --strict --report artifacts/foundation-doctor.json`。
