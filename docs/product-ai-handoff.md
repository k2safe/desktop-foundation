# Product AI Handoff

这份文档给接入产品项目的 AI 或工程师使用。目标是先把产品接入桌面底座，再迁移业务页面；不要先改底座，不要把业务样式硬写进底座。

## 1. 接入顺序

先读取 foundation package manifest：

```text
https://github.com/k2safe/desktop-foundation/releases/download/v0.1.38/foundation-packages.json
```

如果明确要追 `main` 上的最新底座，再读取 development manifest：

```text
https://raw.githubusercontent.com/k2safe/desktop-foundation/main/artifacts/npm/foundation-packages.json
```

把 `consumer.dependencies`、`consumer.devDependencies`、`consumer.pnpm.overrides` 合并进产品 `package.json`，再执行：

```bash
pnpm install
pnpm exec desktop-foundation-ci --integration-check --integration-report artifacts/foundation-integration.json
pnpm build
```

不要把某个旧版本号写进接入提示词或产品代码。稳定接入优先使用 release manifest；当前推荐版本、tarball URL、pnpm overrides 和 Cargo dependency 都以选定 manifest 为准。

然后读取 package manifest 里的 `capabilities.url`。它指向同一版本的机器可读能力清单，外部 AI 需要用它理解底座能力边界，再把 `desktop-foundation-ci --integration-report` 里的 `capabilities` 矩阵作为接入状态。

产品入口必须只 import 一次共享样式：

```tsx
import "@desktop-foundation/ui-react/styles.css";
```

接入顺序固定为：

1. 安装 packages 和 `desktop-core-rs`。
2. 用 `DesktopAppShell` 包住产品入口。
3. 用 `createThemeTemplateRuntime` 选择模板，再覆盖品牌 token。
4. 用 `DesktopLayout` 接菜单、顶部、用户头像和业务路由。
5. 用 `DesktopLoginPage` 接登录页，业务字段通过 `extraFields` 传入。
6. 把表格、表单、弹窗、设置页替换为 foundation 组件。
7. 配置 `updateConfig`，Tauri 项目默认通过 `df_update_install` 接安装边界。
8. 配置 `onAuditEvent` 或 `auditObserver`，把底座 audit events 接到产品日志/审计服务。
9. 如产品有网络代理设置入口，接 `client.proxy`，不要用 `client.linkProxy` 代替用户代理。
10. 跑验收命令，失败项先修复再迁移业务页面。

## 2. 最小代码形状

```tsx
import { DesktopAppShell, DesktopLoginPage } from "@desktop-foundation/app-shell";
import { DesktopLayout } from "@desktop-foundation/ui-react";
import { createThemeTemplateRuntime } from "@desktop-foundation/theme-presets";

const template = createThemeTemplateRuntime("ops-admin", {
  brand: { name: "Product Desktop" },
  colors: { primary: "#2563eb" }
});

export function App() {
  return (
    <DesktopAppShell theme={template.theme} className={template.className} client={clientConfig} locale="zh-CN">
      <DesktopLayout
        variant={template.layout.appShell}
        brand={{ name: "Product Desktop" }}
        menus={menus}
        user={session.user}
        onLogout={session.clearSession}
      >
        <Routes />
      </DesktopLayout>
    </DesktopAppShell>
  );
}
```

多语言入口在 `DesktopAppShell`。底座内置 `zh-CN` 和 `en-US`，产品可以传 `locale`、`messages` 和 `dictionaries` 覆盖通用 UI 文案：

```tsx
<DesktopAppShell
  theme={template.theme}
  client={clientConfig}
  locale={productAdapter.locale}
  messages={productAdapter.messages}
  dictionaries={productAdapter.dictionaries}
>
  <Routes />
</DesktopAppShell>
```

底座只翻译通用 shell/组件文案；菜单、页面标题、业务字段、接口错误仍由产品项目自己维护。业务显式传入的 `title`、`submitLabel`、`emptyTitle` 等 prop 优先级高于语言包。

数字、日期和金额格式化也从底座入口接入。产品在 adapter 放默认币种和时区，页面内使用 `useLocale().format`，不要在各业务页散落 `new Intl.NumberFormat(...)`：

```tsx
<DesktopAppShell
  theme={template.theme}
  client={clientConfig}
  locale={productAdapter.locale}
  messages={productAdapter.messages}
  dictionaries={productAdapter.dictionaries}
  formatDefaults={{ currency: productAdapter.defaultCurrency, timeZone: productAdapter.timeZone }}
  onMissingLocaleKey={(event) => reportDiagnostic("i18n.missing_key", event)}
>
  <Routes />
</DesktopAppShell>
```

缺失 key 只记录 key 和 valueKeys，不记录真实业务值。接入真实多语言前，产品可以用 `getMissingLocaleKeys()` 在 CI 或 build validation 里检查自定义字典。

权限和功能开关也从 `DesktopAppShell` 进入。当前用户权限放在 session user 的 `permissions` / `role` / `roles`，产品本地 feature flag 放在 `accessControl.features`：

```tsx
<DesktopAppShell
  theme={template.theme}
  client={clientConfig}
  accessControl={{ features: { updates: true, reviewWorkbench: false } }}
  session={{ loadUser }}
>
  <Routes />
</DesktopAppShell>
```

菜单、命令、设置分组和详情动作可以直接挂访问规则：

```tsx
const menus = [
  { id: "dashboard", label: "工作台" },
  { id: "orders", label: "订单中心", permission: "orders:read" },
  { id: "settings", label: "设置", permission: "settings:read" }
];

const commands = [
  { id: "export", label: "导出订单", permission: "orders:export" },
  { id: "review", label: "复核台", feature: "reviewWorkbench" }
];
```

页面级用 `AccessGuard`，按钮级可用 `PermissionGuard`。底座只做前端入口隐藏和守卫，接口鉴权必须由产品后端继续兜底。

错误处理默认在底座内。`DesktopAppShell` 默认启用 `DesktopErrorBoundary`，产品可以通过 `errorBoundary.onError` 接入上报：

```tsx
<DesktopAppShell
  theme={template.theme}
  client={clientConfig}
  errorBoundary={{ onError: (error, info) => reportError(error, info.componentStack) }}
>
  <Routes />
</DesktopAppShell>
```

HTTP、网络、未授权、业务 code 会被标准化为 `DesktopError`。业务请求优先用 `useRequest` / `useMutation`，自定义 `try/catch` 使用 `normalizeDesktopError(caught)`，不要在各页面里散落 `new Error(...)` 和字符串错误。

桌面端 HTTP cache 必须走底座 Rust 层，不要在业务页用 `localStorage`、`IndexedDB` 或全局变量自己缓存接口响应：

```ts
const languages = await client.http.get("/settings/languages", {
  cache: {
    key: "settings:languages",
    ttlMs: 60000,
    storage: "persistent",
    staleIfError: true
  },
  onResponse: (metadata) => reportDiagnostic("http.cache", metadata.cache)
});
```

Web/mock demo 可以用 adapter 模拟缓存状态；Tauri 真桌面端由 `desktop-core-rs` 负责 memory/persistent cache、TTL、refresh 和 stale fallback。业务接口返回体不需要包一层 cache envelope，cache metadata 从 `onResponse` 或 `client.diagnostics.getRecentRequests()` 读。

用户网络代理设置也从 client 边界接入。CoinPay 这类管理端需要影响 API、语言包、菜单权限刷新、文件下载和更新下载时，设置页调用 `client.proxy`：

```ts
await client.proxy.setConfig({
  enabled: true,
  mode: "http",
  host: "127.0.0.1",
  port: 7890,
  bypass: ["localhost", "127.0.0.1"]
});

const result = await client.proxy.testConnection("https://api.example.com/health");
```

`client.proxy` 影响 Tauri/Rust-backed 的 `client.http.*`、`client.files.downloadFile` 和默认 `client.updates` 下载链路；`getConfig()` 不返回明文密码，只返回 `hasPassword`。`client.linkProxy` 是任意第三方链接网关能力，不是用户网络代理设置。

正式管理端页面优先用 [AdminKit](admin-kit.md)。列表页用 `AdminPageShell + AdminFilterBar + AdminDataTable`，抽屉详情用 `AdminDrawer + AdminDetailGrid + AdminFormActions`。业务 AI 不要在每个页面临时重写筛选栏、表格容器、状态 pill、抽屉布局或大面积业务 CSS。

审计/诊断事件在 client 边界接入。底座会自动记录登录、退出、权限拒绝、桌面能力、文件下载、更新检查和失败请求；真实业务把 `onAuditEvent` 转发到自己的上报服务：

```tsx
<DesktopAppShell
  theme={template.theme}
  client={{
    ...clientConfig,
    onAuditEvent: (event) => reportAuditEvent(event),
    maxAuditEvents: 200
  }}
>
  <Routes />
</DesktopAppShell>
```

业务页面需要补充关键动作时，调用 `client.diagnostics.recordAuditEvent({ action, ok, metadata })`。不要把密码、token、完整文件内容或其它敏感信息放进 `metadata`。

登录页保留在底座，产品只传文案、认证逻辑和额外字段：

```tsx
<DesktopLoginPage
  template={template.layout.login}
  brand={{ name: "Product Desktop" }}
  title="管理端登录"
  subtitle="业务文案由产品项目自己维护。"
  extraFields={({ payload, setField }) => <OtpField value={payload.otp} onChange={(value) => setField("otp", value)} />}
  login={{ login: loginProductUser, defaultPayload: { account: "", password: "", remember: true } }}
/>
```

## 3. 更新能力

真实业务更新中心的最小接入范例见 [Update Center Integration](update-center-integration.md)。外部 AI 需要先照那份文档确认 env、manifest、`UpdateCenterPanel` 页面模板和验收命令，再迁移产品自己的文案和入口。

GitHub Releases 方式最轻：

```ts
import { createDesktopClient, createGitHubReleasesUpdateConfig } from "@desktop-foundation/bridge";

export const clientConfig = {
  product: "product-desktop",
  version: import.meta.env.VITE_APP_VERSION || "0.1.0",
  apiBaseURL: import.meta.env.VITE_API_BASE_URL,
  updateConfig: createGitHubReleasesUpdateConfig({
    repository: import.meta.env.VITE_UPDATE_GITHUB_REPO || "owner/repo",
    channel: import.meta.env.VITE_UPDATE_CHANNEL || "stable",
    requireChecksumVerification: true
  })
};
```

默认接入阶段做发现新版本、下载更新包、校验 size/sha256，并在 Tauri 里通过 `createTauriDesktopClient` 自动接到底座 `df_update_install`。macOS 下 zip 内含 `.app` 或直接 `.app` 会被 staged 到退出后替换并可 relaunch；`.pkg`、`.dmg` 和其它平台安装包会打开系统安装器。不要在业务页面里写替换 `.app`、安装后重启、relaunch 等逻辑；需要官方 Tauri signed updater 流程时，产品再安装并注册 `@tauri-apps/plugin-updater`，打开 `VITE_TAURI_UPDATER=1`，在 client/native adapter 边界覆盖默认安装器。

UI 当前只调用：

```ts
const result = await client.updates.checkForUpdate();
await client.updates.downloadUpdate(result.update);
await client.updates.installUpdate(result.update);
```

页面只调用 `client.updates.installUpdate(result.update)`，不要在页面里直接操作安装文件。外部 AI 对接时如果看到业务项目自己 `cp/mv/ditto/open /Applications/*.app`，应当删除并回到底座更新能力。

## 4. 上传能力

浏览器或 Tauri UI 里，产品可以直接把 `FormData` 传给底座 HTTP client：

```ts
const form = new FormData();
form.append("release", version);
form.append("package", file);

await client.http.post("/releases", form, { auth: false });
```

不要手动设置 `Content-Type: multipart/form-data`，boundary 由底座 transport 生成。非浏览器调用者可以使用 `multipart.fields` 和 `multipart.files`，文件内容使用 `bodyBase64`。

如果在 Node/headless smoke 里直接创建 client，需要显式传入 `session`、`storage`、`secureStorage`、`desktop`、`files` adapter 或 noop adapter；默认 web adapter 会访问 `window.localStorage`，不适合 Node 进程。

反馈 UI 使用现有受控 API：

```tsx
toast.notify({ title: "上传完成", tone: "success" });
<OfflineBanner visible={!online} />
```

`useToast()` 暴露的是 `notify` 和 `dismiss`，不是 `toast.success()` 这类快捷方法。`OfflineBanner` 控制显隐的 prop 是 `visible`。

## 5. 发布链路

Actions 没额度时，本地 macOS 也可以完整产出 release 文件：

```bash
pnpm tauri build
pnpm exec desktop-foundation-ci \
  --no-type-check \
  --no-build \
  --package-desktop \
  --manifest \
  --release-plan \
  --github-repo owner/repo \
  --channel stable
```

输出在 `artifacts/desktop`：

- `<product>-<version>-macos.zip`
- `<product>-<version>-macos.zip.sha256`
- `latest.json`
- `desktop-artifacts.json`
- `release-plan.json`

`release-plan.json` 里有 `latestManifestUrl`、`downloadUrl`、assets、checksum、`ghReleaseCreate` 和 `ghReleaseUpload`。产品可以手工上传，也可以把命令放进自己的 GitHub Actions。

签名和公证仍归产品项目管理。底座只记录 `--signature-path`、`--signing-identity`、`--notarization-note` 的预留信息，不强制证书和 Apple 账号。

## 6. 验收清单

必须通过：

- `pnpm exec desktop-foundation-ci --integration-check` 没有 fail。
- `artifacts/foundation-integration.json` 里的 `capabilities.summary.fail = 0`，真实业务上线前需要逐项解释或清掉 `recommended-before-release` 能力的 warn。
- `pnpm build` 通过。
- 如果产品有上传链路，增加一个本地 mock server smoke，至少验证 `FormData -> multipart/form-data; boundary=... -> 服务端收到字段和文件`。
- 桌面包能打开，不白屏，不崩溃。
- 左侧、顶部、内容区没有异常白边。
- 登录页使用底座壳，产品字段通过 slot 传入。
- 菜单、顶部头像、退出入口走 `DesktopLayout`。
- 菜单、命令、按钮和设置分组的权限字段走底座 access control，不在业务页面里重复手写过滤。
- 请求错误、render error 和业务错误码走 `DesktopError` / `DesktopErrorBoundary`，不要每个页面单独发明错误形状。
- 登录、退出、权限拒绝、更新、文件下载和关键业务动作能进入 `client.diagnostics.getRecentAuditEvents()`，真实业务配置了 `onAuditEvent` 或 `auditObserver`。
- 多语言接入传入 `locale`、`formatDefaults` 和 `onMissingLocaleKey`，金额/日期/数字使用 `useLocale().format`。
- 表格、筛选、表单、弹窗、设置页优先用 foundation 组件。
- 主题通过模板选择和 token 覆盖完成，不能在业务页大面积覆盖底座 CSS。
- 更新中心能看到 `client.updates.getState()` 状态流转。
- `latest.json` 包含 `version`、`downloadUrl`、`sha256`、`size`。

可后补：

- `pnpm visual:regression`
- 可选 Tauri updater 插件配置、签名和公证
- macOS 签名和公证
- GitHub Actions 自动 release upload

## 7. 反哺规则

接入时遇到这些情况，先记入接入报告，再决定是否回到底座：

- 多个产品都需要的组件、布局、表单、表格能力：回到底座抽象。
- 只属于单个产品的字段、接口、权限、业务状态：留在产品。
- 模板差异是整体布局、登录页结构、表格/表单视觉密度：回到底座模板。
- 单页为了业务流程做的局部样式：留在产品。
- integration-check 失败：先修产品接入，再考虑底座规则是否过严。
- 桌面包白屏、崩溃、窗口异常：优先补底座诊断和脚手架验收。

接入完成后，把 `artifacts/foundation-integration.json`、桌面截图、失败命令输出和需要抽象的点一起回传到底座仓库。
