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

The scaffold contains no product business model, API path, permission model, or route normalization logic.

## Templates

Use `--template` to pick a foundation template at scaffold time. Available ids: `default`, `admin`, `command`, `merchant`, `ledger`, `studio`, `dark`.

The generated app stores the template in `src/theme.ts`, so product teams can switch templates without editing component internals.

## CI Wrapper

`desktop-foundation-ci` is exposed as a bin so product repositories can call foundation checks from GitHub Actions or any other CI system without copying workflow logic.
