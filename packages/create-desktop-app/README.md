# @desktop-foundation/create-desktop-app

Product desktop app scaffold for `desktop-foundation`.

## Usage

```bash
pnpm create @desktop-foundation/desktop-app apps/product-desktop --product product --app-name "Product Desktop" --template command
```

Local development:

```bash
node packages/create-desktop-app/bin/create-desktop-app.mjs examples/product-desktop --product product --app-name "Product Desktop"
```

## Generated Shape

- `src/App.tsx`
- `src/theme.ts`
- `src/menus.tsx`
- `src/api/client.ts`
- `src/pages/DashboardPage.tsx`
- `src-tauri`
- `.github/workflows/desktop-release.yml`

The scaffold contains no product business model, API path, permission model, or route normalization logic.

## Templates

Use `--template` to pick a foundation template at scaffold time. Available ids: `default`, `admin`, `command`, `merchant`, `ledger`, `studio`, `dark`.

The generated app stores the template in `src/theme.ts`, so product teams can switch templates without editing component internals.

## CI Wrapper

`desktop-foundation-ci` is exposed as a bin so product repositories can call foundation checks from GitHub Actions or any other CI system without copying workflow logic.

Verification examples:

```bash
pnpm exec desktop-foundation-ci --type-check --build --strict
pnpm exec desktop-foundation-ci --no-type-check --no-build --visual --strict
```

Packaging and update-manifest example:

```bash
pnpm tauri build
pnpm exec desktop-foundation-ci \
  --no-type-check \
  --no-build \
  --package-desktop \
  --manifest \
  --release-plan \
  --channel stable \
  --download-base-url https://github.com/acme/product/releases/download/v1.0.0
```

On macOS the package step writes a local `.app`, a release `.zip`, `.sha256`, `desktop-artifacts.json`, `latest.json`, and optionally `release-plan.json` under `artifacts/desktop`. This works from a developer machine; GitHub Actions is only one possible caller.
