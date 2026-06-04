# @desktop-foundation/create-desktop-app

Product desktop app scaffold for `desktop-foundation`.

## Usage

```bash
pnpm create @desktop-foundation/desktop-app apps/product-desktop --product product --app-name "Product Desktop"
```

Local development:

```bash
node packages/create-desktop-app/bin/create-desktop-app.mjs examples/product-desktop --product product --app-name "Product Desktop"
```

## Generated Shape

- `src/App.tsx`
- `src/product-adapter.tsx`
- `src/theme.ts`
- `src/menus.tsx`
- `src/api/client.ts`
- `src/pages/DashboardPage.tsx`
- `src-tauri`

The scaffold contains no product business model, API path, permission model, or route normalization logic.

`src/product-adapter.tsx` is the intended product-owned adapter entry: brand, menus, theme template, shell layout, user menu, and client defaults live there so product teams do not edit foundation package internals.

## Doctor

Use `desktop-foundation doctor` to check whether the current product app follows the foundation contract:

```bash
pnpm exec desktop-foundation doctor --report artifacts/foundation-doctor.json
pnpm exec desktop-foundation doctor --strict --report artifacts/foundation-doctor.json
```

`doctor` prints grouped next actions by default. `--strict` exits non-zero on fail or warn findings, which is useful when integration is ready to become a CI gate.

## CI Wrapper

Use `desktop-foundation-ci` from a product app to keep the foundation contract visible:

```bash
pnpm exec desktop-foundation-ci --integration-check --integration-summary --integration-report artifacts/foundation-integration.json
pnpm exec desktop-foundation-ci --type-check --build
pnpm exec desktop-foundation-ci --package-desktop --manifest --release-plan --github-repo owner/repository
```

`--integration-check` validates the required foundation packages, shared stylesheet, app shell, theme template runtime, product adapter, i18n surface, audit events, copied-source risk, table/overlay overflow risk, Tauri core dependency, default capability, update surface, and expected product scripts. `--release-plan --github-repo` writes release metadata with GitHub Release URLs, checksum assets, manifest URL, and `gh release` command arguments without forcing a specific GitHub Actions workflow.
