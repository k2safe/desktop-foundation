# Scaffolding

`@desktop-foundation/create-desktop-app` generates a clean React/Tauri desktop product shell.

## Command

```bash
create-desktop-app apps/product-desktop \
  --product product \
  --app-name "Product Desktop" \
  --api-base "http://127.0.0.1:8891"
```

## Generated Files

- `src/theme.ts`: product theme preset.
- `src/menus.tsx`: product menu config.
- `src/api/client.ts`: Web/Tauri desktop client bootstrap.
- `src/pages/DashboardPage.tsx`: placeholder page using foundation components.
- `src-tauri`: Tauri shell wired to `desktop-core-rs` platform capabilities.

The generated Tauri entry uses `DesktopCore::persistent_platform_with_http_adapter`, so product apps get the shared HTTP transport, session persistence, secure storage, file commands, window commands, clipboard, notification, and open-external contract on day one.

## Boundary

The scaffold intentionally does not generate:

- business API wrappers
- business models
- permission rules
- menu code mappings
- route normalization logic
- product dashboards

Those belong in product repositories.
