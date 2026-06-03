# Product Migration Template

Use this template when a product repository starts consuming `desktop-foundation`. It is written for both human developers and AI agents that need a concrete handoff checklist.

## Goal

Move reusable desktop concerns into the foundation and keep product code focused on business behavior.

Foundation owns:

- desktop app shell, navigation layout, login shell, and theme templates
- common form, table, modal, drawer, settings, status, and update UI primitives
- desktop bridge capabilities for storage, secure storage, files, notifications, windows, HTTP, and updates
- Tauri command contract through `desktop-core-rs`
- CI wrapper, artifact normalization, update manifest, checksum, and release-plan generation

Product owns:

- business routes, data models, API paths, permissions, and copy
- domain-specific page workflows
- brand assets and final theme overrides
- release hosting policy, signing, notarization, and real updater installation behavior

## Required Inputs

Collect these before editing:

- product name and package name
- current frontend entry file
- current shell/layout component
- current login page component
- current theme/CSS entry
- current Tauri `Cargo.toml`, `tauri.conf.json`, and capability files
- desired template id: `admin`, `command`, `ledger`, `merchant`, `studio`, `dark`, or `default`
- GitHub release repository for desktop updates, for example `owner/repository`

## Package Install

Read the current package manifest:

```text
https://raw.githubusercontent.com/k2safe/desktop-foundation/main/artifacts/npm/foundation-packages.json
```

Copy `consumer.dependencies`, `consumer.devDependencies`, and `consumer.pnpm.overrides` into the product `package.json`, then run:

```bash
pnpm install
pnpm exec desktop-foundation-ci --integration-check
```

The shared stylesheet must be imported once in the frontend entry:

```ts
import "@desktop-foundation/ui-react/styles.css";
```

## Theme And Layout

Create a product theme adapter. Keep product-specific colors here instead of editing foundation styles.

```ts
import { createThemeTemplateRuntime, type ThemeTemplateId } from "@desktop-foundation/theme-presets";

export const defaultTemplateId: ThemeTemplateId = "admin";

export function createProductTemplate(templateId: ThemeTemplateId = defaultTemplateId) {
  return createThemeTemplateRuntime(templateId, {
    brand: { name: "Product Desktop" },
    colors: {
      primary: "#3b00f5",
      primaryHover: "#2700c7"
    }
  });
}
```

Use:

- `template.theme` in `DesktopAppShell`
- `template.className` in `DesktopAppShell`
- `template.layout.appShell` in `DesktopLayout`
- `template.layout.login` in `DesktopLoginPage`

## App Shell

Wrap the product app with foundation shell components. Product code supplies menus, user data, and page content.

```tsx
import { DesktopAppShell } from "@desktop-foundation/app-shell";
import { DesktopLayout } from "@desktop-foundation/ui-react";
import { createProductClient } from "./client";
import { createProductTemplate } from "./theme";

const template = createProductTemplate("admin");
const client = createProductClient();

export function App() {
  return (
    <DesktopAppShell theme={template.theme} className={template.className} client={client}>
      <DesktopLayout
        variant={template.layout.appShell}
        brand={{ name: "Product Desktop" }}
        menus={menus}
        user={session.user}
      >
        <Routes />
      </DesktopLayout>
    </DesktopAppShell>
  );
}
```

## Login Shell

Use foundation login layout and pass product fields through slots. Do not fork the foundation login component for OTP, tenant, or environment fields.

```tsx
import { DesktopLoginPage } from "@desktop-foundation/app-shell";
import { Input } from "@desktop-foundation/ui-react";

<DesktopLoginPage
  brand={{ name: "Product Desktop" }}
  title="管理端登录"
  template={template.layout.login}
  accountLabel="账号"
  passwordLabel="密码"
  extraFields={({ payload, setField }) => (
    <Input
      label="验证码"
      placeholder="未开启时可留空"
      value={payload.otp ?? ""}
      onChange={(event) => setField("otp", event.target.value)}
    />
  )}
  login={{
    defaultPayload: { account: "admin", password: "", remember: true },
    login: async (client, payload) => client.http.post("/admin/login", payload, { auth: false })
  }}
/>
```

## Desktop Bridge

Assemble `DesktopClient` once, then pass it through the app shell.

```ts
import {
  createDesktopClient,
  createGitHubReleasesUpdateConfig,
  createTauriDesktopCapability,
  createTauriFileCapability,
  createTauriKeyValueStore,
  createTauriSecureStorage,
  createTauriSessionStore
} from "@desktop-foundation/bridge";

export async function createProductClient() {
  return createDesktopClient({
    product: "product-desktop",
    apiBaseURL: "https://api.example.com",
    session: await createTauriSessionStore(invoke, "product-desktop"),
    storage: createTauriKeyValueStore(invoke, "product-desktop", "user"),
    secureStorage: createTauriSecureStorage(invoke, "product-desktop"),
    desktop: createTauriDesktopCapability(invoke),
    files: createTauriFileCapability(invoke, "product-desktop"),
    updateConfig: createGitHubReleasesUpdateConfig({
      currentVersion: import.meta.env.VITE_APP_VERSION,
      repository: "owner/repository",
      channel: "stable",
      requireChecksumVerification: true
    })
  });
}
```

## Tauri Core

Add the Rust foundation package:

```toml
desktop-core-rs = { git = "ssh://git@github.com/k2safe/desktop-foundation.git", branch = "main", package = "desktop-core-rs", features = ["tauri"] }
```

Add the generated Tauri permission:

```json
{
  "identifier": "default",
  "permissions": [
    "core:default",
    "desktop-core:default"
  ]
}
```

## Release And Update

Use the wrapper to generate desktop artifacts, update manifest, checksums, and a release plan.

```bash
pnpm exec desktop-foundation-ci \
  --package-desktop \
  --manifest \
  --release-plan \
  --github-repo owner/repository \
  --preview-bundle-id com.example.product.preview \
  --preview-name "Product Desktop Preview"
```

The product can upload `artifacts/desktop/*` manually, through GitHub Actions, or through its own release pipeline. The client only needs the manifest URL to be reachable.

## Validation

Run this sequence after migration:

```bash
pnpm install
pnpm exec desktop-foundation-ci --integration-check --integration-report artifacts/foundation-integration.json
pnpm build
pnpm visual:regression
pnpm tauri build
```

Expected result:

- `integration-check` has zero failures
- `pnpm build` passes
- product UI still owns business pages
- foundation components own shared layout, login, table, form, modal, and update surfaces

## AI Agent Instruction Block

Paste this into another AI agent working inside a product repo:

```text
You are integrating this product app with desktop-foundation.

Do not edit desktop-foundation internals. Consume the published packages and use product-level adapters.

Use https://raw.githubusercontent.com/k2safe/desktop-foundation/main/artifacts/npm/foundation-packages.json for package URLs.

Tasks:
1. Add @desktop-foundation/bridge, ui-react, app-shell, theme-presets, and create-desktop-app from the manifest.
2. Import @desktop-foundation/ui-react/styles.css once.
3. Replace product-owned generic shell/layout primitives with DesktopAppShell and DesktopLayout.
4. Replace login layout with DesktopLoginPage, using extraFields for product-only fields such as OTP.
5. Create a theme adapter with createThemeTemplateRuntime. Do not patch foundation CSS for product colors.
6. Add desktop-core-rs to src-tauri/Cargo.toml and desktop-core:default to Tauri capabilities.
7. Configure updateConfig with createGitHubReleasesUpdateConfig({ repository: "<owner/repo>" }).
8. Update package scripts to include desktop-foundation-ci --integration-check and desktop-foundation-ci --package-desktop --manifest --release-plan --github-repo <owner/repo>.
9. Run pnpm exec desktop-foundation-ci --integration-check, pnpm build, and the product desktop build.

Report every integration-check failure with file paths and fix it before changing product business pages.
```
