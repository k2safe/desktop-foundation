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
- `src/theme.ts`
- `src/menus.tsx`
- `src/api/client.ts`
- `src/pages/DashboardPage.tsx`
- `src-tauri`

The scaffold contains no product business model, API path, permission model, or route normalization logic.
