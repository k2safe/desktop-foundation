# Update Center Integration

这份文档给真实业务项目或外部 AI 使用。目标是把产品的“更新中心”接到底座能力，而不是在业务页面里自己处理下载、替换 `.app`、重启或打开安装器。

底座从 `v0.1.32` 开始已经把默认 Tauri 安装边界公开完整；从 `v0.1.33` 开始提供可直接复用的 `UpdateCenterPanel`：

- `createTauriDesktopClient(...)` 会把 manifest update flow 接到 `plugin:desktop-core|df_update_install`。
- `createTauriUpdateInstallAdapter(...)` 从 `@desktop-foundation/bridge` 根入口导出，手动组装能力时也能复用。
- `desktop-foundation smoke` 会检查 `df_update_install` request mapping。

## Product Boundary

产品负责：

- release hosting，比如 GitHub Releases、OSS/S3、CDN 或内部制品服务
- `latest.json` manifest 的发布
- macOS 签名、公证、bundle id、版本号和 rollout 策略
- 是否启用官方 Tauri signed updater
- 更新中心页面的业务文案、权限入口和审计上报

底座负责：

- 检查 manifest
- 下载更新包
- 校验 `size` 和 `sha256`
- 维护 `client.updates.getState()` 状态流
- 在 Tauri 默认路径调用 `df_update_install`
- 在 macOS 上 staging `.app` 替换，或打开 `.pkg`、`.dmg` 等系统安装包

业务页面只调用 `client.updates.*`。不要在页面里直接使用 `cp`、`mv`、`ditto`、`open /Applications/*.app`、`relaunch` 或 Tauri shell/process 命令。

## 1. Use The Release Manifest

稳定接入优先读取当前 release manifest：

```text
https://github.com/k2safe/desktop-foundation/releases/download/v0.1.33/foundation-packages.json
```

把 `consumer.dependencies`、`consumer.devDependencies` 和 `consumer.pnpm.overrides` 合并到产品 `package.json`。不要在产品提示词或代码里写死某个旧 tarball URL。

## 2. Product Env

GitHub Releases 最小配置：

```bash
VITE_APP_VERSION=1.0.0
VITE_API_BASE_URL=https://api.example.com
VITE_UPDATE_GITHUB_REPO=owner/product-desktop
VITE_UPDATE_CHANNEL=stable
VITE_UPDATE_REQUIRE_CHECKSUM=1
```

静态 manifest 或私有制品服务配置：

```bash
VITE_APP_VERSION=1.0.0
VITE_API_BASE_URL=https://api.example.com
VITE_UPDATE_MANIFEST_URL=https://releases.example.com/product/latest.json
VITE_UPDATE_CHANNEL=stable
VITE_UPDATE_REQUIRE_CHECKSUM=1
```

只有产品明确使用官方 Tauri signed updater 时才开启：

```bash
VITE_TAURI_UPDATER=1
```

开启后产品还需要安装并配置 `@tauri-apps/plugin-updater`。不开启时，默认 manifest flow 会继续走 `df_update_install`。

## 3. Manifest Shape

`latest.json` 至少包含：

```json
{
  "version": "1.0.1",
  "channel": "stable",
  "notes": "修复批量导出并优化更新中心状态。",
  "pubDate": "2026-06-04T12:00:00.000Z",
  "releasePageUrl": "https://github.com/owner/product-desktop/releases/tag/v1.0.1",
  "downloadUrl": "https://github.com/owner/product-desktop/releases/download/v1.0.1/product-desktop-1.0.1-macos.zip",
  "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "size": 12345678,
  "metadata": {
    "appName": "Product Desktop",
    "targetPath": "/Applications/Product Desktop.app",
    "relaunch": true,
    "backup": true
  }
}
```

字段说明：

- `version`: 新版本号，底座会和当前 `VITE_APP_VERSION` 比较。
- `channel`: 和 `VITE_UPDATE_CHANNEL` 匹配时才提示。
- `downloadUrl`: 更新包 URL。相对路径会以 manifest URL 为基准解析。
- `sha256`: 强烈建议必填，并打开 `VITE_UPDATE_REQUIRE_CHECKSUM=1`。
- `size`: 建议必填，底座会校验下载字节数。
- `metadata.targetPath`: 可传 `.app` 目标路径或目标目录。
- `metadata.appName`: 没有 `targetPath` 时用于推导 `/Applications/<appName>.app`。
- `metadata.relaunch`: 安装后是否尝试重新打开 app。
- `metadata.backup`: 替换前是否备份旧 app。

## 4. Client Wiring

脚手架模板已经内置这段形状。真实项目可以放在 `src/api/client.ts`：

```ts
import {
  createDesktopClient,
  createGitHubReleasesUpdateConfig,
  createTauriDesktopClient,
  createTauriUpdaterPluginAdapters,
  type AppUpdateConfig,
  type TauriNativePluginAdapters,
  type TauriUpdaterPluginModule
} from "@desktop-foundation/bridge";
import { invoke } from "@tauri-apps/api/core";

const appVersion = import.meta.env.VITE_APP_VERSION || "0.1.0";

function envValue(name: string) {
  return (import.meta.env[name] as string | undefined)?.trim();
}

function createProductUpdateConfig(currentVersion: string): AppUpdateConfig {
  const manifestUrl = envValue("VITE_UPDATE_MANIFEST_URL");
  const githubRepository = envValue("VITE_UPDATE_GITHUB_REPO");
  const channel = envValue("VITE_UPDATE_CHANNEL") || "stable";

  if (manifestUrl) {
    return {
      currentVersion,
      manifestUrl,
      channel,
      requireChecksumVerification: envValue("VITE_UPDATE_REQUIRE_CHECKSUM") === "1"
    };
  }

  if (githubRepository) {
    return createGitHubReleasesUpdateConfig({
      currentVersion,
      repository: githubRepository,
      tag: envValue("VITE_UPDATE_TAG"),
      manifestFileName: envValue("VITE_UPDATE_MANIFEST_FILE") || "latest.json",
      channel,
      requireChecksumVerification: envValue("VITE_UPDATE_REQUIRE_CHECKSUM") === "1"
    });
  }

  return { currentVersion, channel };
}

const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<unknown>;

async function createProductNativePlugins(): Promise<TauriNativePluginAdapters | undefined> {
  if (envValue("VITE_TAURI_UPDATER") !== "1") return undefined;

  const updater = await dynamicImport("@tauri-apps/plugin-updater") as TauriUpdaterPluginModule;
  return createTauriUpdaterPluginAdapters(updater);
}

export async function createProductClient() {
  const clientConfig = {
    product: "product-desktop",
    version: appVersion,
    apiBaseURL: envValue("VITE_API_BASE_URL") || "https://api.example.com",
    updateConfig: createProductUpdateConfig(appVersion),
    onAuditEvent: (event) => {
      if (import.meta.env.DEV) console.debug("[foundation:audit]", event.action, event);
    }
  };

  if ("__TAURI_INTERNALS__" in window) {
    return createTauriDesktopClient(invoke, {
      ...clientConfig,
      nativePlugins: await createProductNativePlugins()
    });
  }

  return createDesktopClient(clientConfig);
}
```

手动组装更新能力时，可以直接复用底座 adapter：

```ts
import { createManifestUpdateCapability, createTauriUpdateInstallAdapter } from "@desktop-foundation/bridge";
import { invoke } from "@tauri-apps/api/core";

const updates = createManifestUpdateCapability(
  {
    manifestUrl: import.meta.env.VITE_UPDATE_MANIFEST_URL,
    currentVersion: import.meta.env.VITE_APP_VERSION,
    requireChecksumVerification: true,
    installUpdate: createTauriUpdateInstallAdapter(invoke, { appName: "Product Desktop" })
  },
  desktop,
  files
);
```

## 5. Minimal Update Center Page

产品可以直接复用 app-shell 提供的页面模板：

```tsx
import { UpdateCenterPanel } from "@desktop-foundation/app-shell";

export function UpdateCenterPage() {
  return <UpdateCenterPanel />;
}
```

如果没有使用 `DesktopClientProvider`，显式传入 client：

```tsx
<UpdateCenterPanel client={client} />
```

嵌在设置页 section 里时，通常关闭内部标题：

```tsx
<UpdateCenterPanel
  client={client}
  showHeader={false}
  labels={{
    check: "检查更新",
    download: "下载",
    install: "安装",
    releasePage: "发布页"
  }}
/>
```

这个模板只读状态、触发动作、展示结果。需要完全自定义页面时，业务代码仍然只调用 `client.updates.*`：

```tsx
import { useEffect, useState } from "react";
import type { AppUpdateState, DesktopClient } from "@desktop-foundation/bridge";
import { Button, CodeBlock, ContentPanel, PageHeader, StatusTag } from "@desktop-foundation/ui-react";

export function UpdateCenterPage({ client }: { client: DesktopClient }) {
  const [state, setState] = useState<AppUpdateState>(() => client.updates.getState());
  const [busy, setBusy] = useState(false);
  const update = state.update;

  async function run(task: () => Promise<unknown>) {
    setBusy(true);
    try {
      await task();
    } finally {
      setState(client.updates.getState());
      setBusy(false);
    }
  }

  useEffect(() => {
    setState(client.updates.getState());
  }, [client]);

  return (
    <ContentPanel>
      <PageHeader
        title="更新中心"
        description="检查、下载并安装产品桌面端更新。"
        actions={
          <>
            <Button disabled={busy} onClick={() => run(() => client.updates.checkForUpdate())}>检查更新</Button>
            <Button disabled={busy || !update?.downloadUrl} onClick={() => run(() => client.updates.downloadUpdate(update))}>下载</Button>
            <Button disabled={busy || !state.downloadedPath} onClick={() => run(() => client.updates.installUpdate(update))}>安装</Button>
          </>
        }
      />

      <StatusTag status={state.status} tone={state.status === "error" ? "danger" : "neutral"} />
      {update ? <CodeBlock>{JSON.stringify(update, null, 2)}</CodeBlock> : null}
      {state.installMessage ? <p>{state.installMessage}</p> : null}
      {state.error ? <p>{state.error}</p> : null}
    </ContentPanel>
  );
}
```

产品可以替换文案、布局和权限入口，但不要把安装文件操作塞进这个页面。

## 6. Local Release Without GitHub Actions

GitHub Actions 没额度时，产品仓库可以本地打包并生成 manifest：

```bash
pnpm tauri build
pnpm exec desktop-foundation-ci \
  --no-type-check \
  --no-build \
  --package-desktop \
  --manifest \
  --release-plan \
  --github-repo owner/product-desktop \
  --channel stable
```

发布时把这些文件放到 release host：

- `<product>-<version>-macos.zip`
- `<product>-<version>-macos.zip.sha256`
- `latest.json`
- 可选 `release-plan.json`

如果是 GitHub Releases，`createGitHubReleasesUpdateConfig` 默认读取 `latest/download/latest.json`，也可以用 `VITE_UPDATE_TAG` 锁定特定 tag 做测试。

## 7. Acceptance Checklist

接入完成后跑：

```bash
pnpm exec desktop-foundation-ci --integration-check --integration-report artifacts/foundation-integration.json
pnpm exec desktop-foundation smoke --report artifacts/foundation-smoke.json
pnpm build
```

真实业务上线前确认：

- `artifacts/foundation-integration.json` 没有 fail。
- `updates` capability 不是 fail；warn 必须写清原因。
- 更新中心能从 `idle/checking/available/downloading/downloaded/installing` 走完整状态。
- 下载包 `size` 和 `sha256` 校验通过。
- `installUpdate` 只调用底座或官方 Tauri updater adapter。
- 没有业务代码直接替换 `.app`、操作 `/Applications` 或 relaunch。
- 更新检查、下载、安装和失败情况进入 `client.diagnostics.getRecentAuditEvents()`。
- 产品自己的签名、公证、发布审批和灰度策略已经验收。
