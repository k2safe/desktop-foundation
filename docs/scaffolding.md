# Scaffolding

`@desktop-foundation/create-desktop-app` generates a clean React/Tauri desktop product shell.

## Command

```bash
create-desktop-app apps/product-desktop \
  --product product \
  --app-name "Product Desktop" \
  --api-base "http://127.0.0.1:8891" \
  --template command
```

## Generated Files

- `src/theme.ts`: product theme preset.
- `src/menus.tsx`: product menu config.
- `src/product-adapter.tsx`: product-owned adapter for brand, menu, layout, login template, user menu, theme, and client defaults.
- `src/api/client.ts`: Web/Tauri desktop client bootstrap.
- `src/pages/DashboardPage.tsx`: placeholder page using foundation components. The generated `src/App.tsx` also wires `DesktopLoginPage` through `AuthGuard`, so products can replace authentication without forking the foundation login shell.
- `src-tauri`: Tauri shell wired to `desktop-core-rs` platform capabilities.

The generated Tauri entry uses `DesktopCore::persistent_platform_with_http_adapter`, so product apps get the shared HTTP transport, session persistence, secure storage, file commands, window commands, clipboard, notification, and open-external contract on day one.

The Tauri template also emits `src-tauri/capabilities/default.json` with `core:default` and `desktop-core:default` enabled. That keeps the generated desktop package aligned with Tauri 2 ACL rules without product teams editing the Rust plugin manifest.

## Template Selection

Generated apps accept a foundation template id through `--template`. Current ids are `default`, `admin`, `command`, `merchant`, `ledger`, `studio`, and `dark`. Templates control the shell layout, login layout, surface density, and theme tokens while keeping product code outside component internals.

## Window Chrome

The scaffold applies the foundation desktop chrome preset by default. The preset keeps the native operating-system controls while removing the awkward gray title strip on macOS:

| Preset | macOS | Windows / Linux | Use case |
| --- | --- | --- | --- |
| `foundation` | decorated window, hidden title, overlay title bar, traffic lights on the dark shell | decorated native frame | default product desktop shell |
| `native` | fully native title bar | fully native title bar | conservative internal tools |
| `frameless` | no native decorations | no native decorations | products that implement their own drag region and window controls |

The generated `tauri.conf.json` follows `foundation`: `hiddenTitle: true`, `titleBarStyle: "Overlay"`, `trafficLightPosition`, and a dark `backgroundColor`. CSS also reserves `--df-desktop-top-offset` so product navigation does not collide with the native controls. The default is compact; products that use a fully native title bar can set `--df-desktop-top-offset: 0px`, while products with custom controls can raise it locally. Preset definitions live in `@desktop-foundation/theme-presets`; use `getWindowChromePlatformConfig` or `createTauriWindowChromeConfig` when tooling needs to inspect or generate platform-specific values.

Product projects can override chrome config when they have platform-specific needs, but should not patch layout internals for window chrome.

## Doctor

Generated projects include:

```bash
pnpm doctor
```

The script runs `desktop-foundation doctor --report artifacts/foundation-doctor.json` and checks package versions, stylesheet import, app shell usage, theme template runtime, Tauri core wiring, update surface, and expected package scripts. It does not validate product business APIs or permissions.

## Optional Visual Regression

Generated projects include `visual:regression` and `visual:regression:update`. The script is intentionally lightweight: it skips until `VISUAL_REGRESSION_URL` is set and Playwright is available in the product repo. Products that opt in should add `playwright` as a dev dependency and install Chromium once.

```bash
pnpm dev:web
VISUAL_REGRESSION_URL=http://127.0.0.1:5173 pnpm visual:regression:update
VISUAL_REGRESSION_URL=http://127.0.0.1:5173 pnpm visual:regression
```

This keeps early product integration fast while still giving each product a standard place for UI baselines.

## Boundary

The scaffold intentionally does not generate:

- business API wrappers
- business models
- permission rules
- menu code mappings
- route normalization logic
- product dashboards

Those belong in product repositories.
