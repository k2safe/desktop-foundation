# Existing Project Migration Case

This is a generic case study for migrating an existing React/Tauri desktop product to desktop-foundation. Replace placeholder names with the product repository's own names.

## Starting Point

The product already has:

- a custom app shell and sidebar
- a custom login page
- several table-heavy business pages
- Tauri commands for storage, files, notifications, and HTTP
- a local release script that produces a desktop bundle

The goal is not to rewrite business pages first. The goal is to replace reusable foundation surfaces and keep business code stable.

## Step 1: Freeze Product Boundaries

Create or identify these product-owned files:

```text
src/product-adapter.tsx
src/theme.ts
src/menus.tsx
src/api/client.ts
src/pages/*
src-tauri/*
```

Move product brand, menu labels, user menu items, API defaults, and update config into `src/product-adapter.tsx`. Do not move business API paths or domain models into foundation code.

## Step 2: Install Foundation Packages

Copy `consumer.dependencies`, `consumer.devDependencies`, and `consumer.pnpm.overrides` from:

```text
https://github.com/k2safe/desktop-foundation/releases/download/v0.1.36/foundation-packages.json
```

Then run:

```bash
pnpm install
pnpm exec desktop-foundation doctor --report artifacts/foundation-doctor.json
```

Fix fail findings first. Warn findings can be handled after the shell is stable.

## Step 3: Replace Shell Before Pages

Before:

```tsx
<LegacyShell user={user} menu={menu}>
  <Routes />
</LegacyShell>
```

After:

```tsx
import { DesktopAppShell } from "@desktop-foundation/app-shell";
import { DesktopLayout } from "@desktop-foundation/ui-react";
import { productAdapter } from "./product-adapter";
import { client } from "./api/client";

<DesktopAppShell theme={productAdapter.theme} className={productAdapter.className} client={client}>
  <DesktopLayout
    variant={productAdapter.layout}
    brand={productAdapter.brand}
    menus={productAdapter.menus}
    user={productAdapter.user}
    userMenuItems={productAdapter.userMenuItems}
  >
    <Routes />
  </DesktopLayout>
</DesktopAppShell>
```

Keep existing routes and pages working first. Polish individual pages later.

## Step 4: Replace Login Shell

Before:

```tsx
<LegacyLoginForm onSubmit={login} />
```

After:

```tsx
import { DesktopLoginPage } from "@desktop-foundation/app-shell";

<DesktopLoginPage
  template={productAdapter.loginTemplate ?? "brand-panel"}
  brand={productAdapter.brand}
  title="登录"
  extraFields={productAdapter.loginExtraFields}
  login={loginConfig}
/>
```

Keep product-only fields such as OTP, tenant code, or environment selection in `extraFields`.

## Step 5: Normalize Tables And Overlays

- Replace wide list pages with `DataTable` or `Table`.
- Set `minWidth` on wide columns.
- Keep horizontal scrolling inside `df-table-wrap` or the foundation table component.
- For modal/drawer pages, make the overlay body scroll locally and keep wide tables inside a table container.

## Step 6: Bridge Desktop Capabilities

Use `createTauriDesktopClient` for Tauri products. Keep product API paths and auth behavior in product code, but route reusable storage/files/notify/window/update capabilities through the foundation bridge.

## Step 7: Release And Updates

Start with manifest checks:

```bash
pnpm exec desktop-foundation-ci --package-desktop --manifest --release-plan --github-repo owner/repository
```

When the product is ready for native install, add the Tauri updater adapter from `docs/tauri-updater-adapter.md`.

## Step 8: Validate

```bash
pnpm exec desktop-foundation doctor --report artifacts/foundation-doctor.json
pnpm build
pnpm package:desktop
```

Use `--strict` only after every warn is fixed or intentionally accepted:

```bash
pnpm exec desktop-foundation doctor --strict --report artifacts/foundation-doctor.json
```
