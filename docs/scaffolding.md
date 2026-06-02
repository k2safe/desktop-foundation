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

## Window Chrome

The scaffold applies the foundation desktop chrome by default on macOS:

- `hiddenTitle: true` hides the native title text.
- `titleBarStyle: "Overlay"` removes the gray native title strip while keeping normal window controls.
- `trafficLightPosition` places the red/yellow/green controls on the dark shell background.
- `--df-desktop-top-offset` reserves the web safe area so product navigation does not collide with native controls.

Product projects can override those values when they need a fully native title bar, but should not patch layout internals for window chrome.

## Boundary

The scaffold intentionally does not generate:

- business API wrappers
- business models
- permission rules
- menu code mappings
- route normalization logic
- product dashboards

Those belong in product repositories.
