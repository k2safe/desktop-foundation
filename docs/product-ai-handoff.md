# Product AI Handoff

这份文档给接入产品项目的 AI 或工程师使用。目标是先把产品接入桌面底座，再迁移业务页面；不要先改底座，不要把业务样式硬写进底座。

## 1. 接入顺序

先读取 foundation package manifest：

```text
https://github.com/k2safe/desktop-foundation/releases/download/v0.1.24/foundation-packages.json
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
7. 配置 `updateConfig`，先接 manifest 检查，安装器后补。
8. 跑验收命令，失败项先修复再迁移业务页面。

## 2. 最小代码形状

```tsx
import { DesktopAppShell, DesktopLoginPage } from "@desktop-foundation/app-shell";
import { DesktopLayout } from "@desktop-foundation/ui-react";
import { createThemeTemplateRuntime } from "@desktop-foundation/theme-presets";

const template = createThemeTemplateRuntime("admin", {
  brand: { name: "Product Desktop" },
  colors: { primary: "#3b00f5" }
});

export function App() {
  return (
    <DesktopAppShell theme={template.theme} client={clientConfig} locale="zh-CN">
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

默认接入阶段只做发现新版本、下载更新包、校验 size/sha256。不要在业务页面里写替换 `.app`、安装后重启、relaunch 等逻辑；需要真实安装时，产品安装并注册 Tauri updater 插件，打开 `VITE_TAURI_UPDATER=1`，在 client/native adapter 边界接入。

UI 当前只调用：

```ts
const result = await client.updates.checkForUpdate();
await client.updates.downloadUpdate(result.update);
await client.updates.openUpdatePage(result.update);
```

adapter 接好后，页面仍然只调用 `client.updates.installUpdate(result.update)`，不要在页面里直接操作安装文件。

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
- `pnpm build` 通过。
- 如果产品有上传链路，增加一个本地 mock server smoke，至少验证 `FormData -> multipart/form-data; boundary=... -> 服务端收到字段和文件`。
- 桌面包能打开，不白屏，不崩溃。
- 左侧、顶部、内容区没有异常白边。
- 登录页使用底座壳，产品字段通过 slot 传入。
- 菜单、顶部头像、退出入口走 `DesktopLayout`。
- 菜单、命令、按钮和设置分组的权限字段走底座 access control，不在业务页面里重复手写过滤。
- 请求错误、render error 和业务错误码走 `DesktopError` / `DesktopErrorBoundary`，不要每个页面单独发明错误形状。
- 表格、筛选、表单、弹窗、设置页优先用 foundation 组件。
- 主题通过模板选择和 token 覆盖完成，不能在业务页大面积覆盖底座 CSS。
- 更新中心能看到 `client.updates.getState()` 状态流转。
- `latest.json` 包含 `version`、`downloadUrl`、`sha256`、`size`。

可后补：

- `pnpm visual:regression`
- Tauri updater 插件配置、签名和公证
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
