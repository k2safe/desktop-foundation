# Product Integration Demo

`examples/demo-product` is the standard generic product integration demo for `desktop-foundation`.

It is intentionally structured like a real business desktop project, while keeping all
business data mocked. The goal is to prove foundation capabilities, not to ship a
specific payments/order domain.

- `client.ts`: product client wiring, mocked transport, storage, secure storage, desktop, and file capabilities.
- `data.ts`: product-owned data models and fixture data.
- `screens/*`: product screens composed from foundation UI.
- `App.tsx`: app shell, session, login, layout, navigation, command palette, and debug panel.
- `vite.config.ts`: local demo API middleware for desktop HTTP/multipart self-checks during Tauri dev.
- `src-tauri/*`: a runnable Tauri shell that wires `desktop-core-rs` and the bridge plugin.

## Run

Web demo:

```sh
pnpm --filter @desktop-foundation/demo-product dev --port 3000
```

Desktop demo:

```sh
pnpm --filter @desktop-foundation/demo-product dev:desktop
```

If the Vite server is already running on `127.0.0.1:3000`, the desktop shell can be
started without spawning another server:

```sh
pnpm --filter @desktop-foundation/demo-product exec tauri dev --no-watch --no-dev-server-wait -c '{"build":{"beforeDevCommand":null}}'
```

## Build

Web bundle:

```sh
pnpm --filter @desktop-foundation/demo-product build
```

Unsigned macOS `.app` bundle:

```sh
pnpm --filter @desktop-foundation/demo-product exec tauri build --bundles app --no-sign -c '{"bundle":{"active":true,"targets":["app"],"icon":["icons/icon.png"]}}'
```

Output:

```text
examples/demo-product/src-tauri/target/release/bundle/macos/Product Demo.app
```

## Foundation Capabilities Covered

- Desktop admin shell: sidebar, topbar, command palette, user menu, responsive desktop spacing.
- UI kit: metrics, filter bars, data tables, drawers, settings sections, tabs, segmented controls, status chips.
- Theme templates: product-owned template switching through foundation theme presets.
- I18n: shared language keys and runtime locale switching for Chinese and English.
- Bridge HTTP: JSON requests, response metadata, request audit logs, and desktop-only Rust cache options.
- Foundation QA console: one-click checks for HTTP cache, multipart upload, update install boundary, session/storage/secure storage, notifications, and diagnostics.
- Desktop native bridge: notifications, file export/open, window state, update check/install abstraction, diagnostics, and audit events.
- Product boundary: product data and routes stay mocked; foundation APIs stay reusable.

## Desktop HTTP Cache Boundary

Desktop HTTP cache must be requested through the bridge:

```ts
client.http.get("/demo-api/languages.json", {
  cache: {
    key: "demo-product:languages",
    ttlMs: 60_000,
    storage: "persistent",
    staleIfError: true,
  },
});
```

In Tauri this cache is owned by `desktop-core-rs`, not by browser `localStorage`,
`IndexedDB`, or page-level globals. The web demo has a small fallback so the same
screen can run in a browser, but product desktop integrations should treat Rust as
the source of truth for desktop cache state.

## Visual QA

Open the `.app` bundle above for the authoritative desktop layout. The browser
version is useful for fast iteration, but the Tauri window is the source for titlebar,
topbar height, native bridge, and cache behavior checks.

Inside this monorepo it uses `workspace:*` dependencies. In the standalone GitHub demo, switch those dependencies to released package versions.
