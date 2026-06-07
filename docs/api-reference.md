# API Reference

## TypeScript Bridge

`createDesktopClient(config)` returns a product-scoped client:

- `client.http.get/post/put/patch/delete`
- `client.session`
- `client.storage`
- `client.secureStorage`
- `client.desktop`
- `client.files`
- `client.updates`
- `client.proxy`
- `client.linkProxy`
- `client.diagnostics`

Required config:

- `product`: namespace for session, storage, diagnostics, and Tauri commands.
- `apiBaseURL`: base API URL.

Optional config:

- `tokenKey`
- `transport`
- `session`
- `storage`
- `secureStorage`
- `desktop`
- `files`
- `updates`
- `proxy`
- `updateConfig`
- `linkProxy`
- `version`
- `security`
- `requestObserver`
- `auditObserver`
- `onUnauthorized`
- `onAuditEvent`
- `defaultHeaders`
- `maxRequestLogEntries`
- `maxAuditEvents`

## HTTP

```ts
await client.http.get("/orders", {
  query: { page: 1 },
  timeoutMs: 10000,
  requestId: "orders-page-1"
});
```

Options:

- `headers`
- `query`
- `body`
- `bodyBase64`
- `bodyContentType`
- `multipart`
- `responseType`: `json`, `text`, or `base64`
- `timeoutMs`
- `signal`
- `auth`
- `requestId`
- `namespace`
- `cache`
- `onResponse`

Desktop HTTP uses the native Rust HTTP adapter for ordinary JSON/raw-body API calls in Tauri. Browser `FormData` is still serialized into the Rust command contract; products that require multipart before native multipart lands can explicitly inject `CurlHttpAdapter` as a temporary adapter:

```ts
const form = new FormData();
form.append("release", "0.1.20");
form.append("package", zipFile);

await client.http.post("/releases", form);
```

Do not set `Content-Type: multipart/form-data` manually for `FormData` uploads; the transport owns the boundary. For non-browser callers, use `multipart.fields` and `multipart.files` with file `bodyBase64`.

Desktop HTTP cache is requested from the normal bridge API and is owned by the Rust core in Tauri:

```ts
await client.http.get("/settings/languages", {
  cache: {
    key: "settings:languages",
    ttlMs: 60000,
    storage: "persistent",
    staleIfError: true
  },
  onResponse: (metadata) => {
    console.log(metadata.cache?.hit, metadata.cache?.storage);
  }
});
```

`storage: "persistent"` survives app restart in the Rust persistence file; `storage: "memory"` is process-local. `refresh: true` bypasses a fresh cache entry and rewrites it after a successful response. `staleIfError: true` lets Rust return an expired entry if the adapter fails. The business response body is unchanged; cache metadata is available through `onResponse` and `client.diagnostics.getRecentRequests()`.

When a Node or headless smoke test calls `createDesktopClient` directly, provide explicit adapters for browser-backed capabilities. The default web client uses `window.localStorage` for storage, so a plain Node process should pass memory/noop implementations for `session`, `storage`, `secureStorage`, `desktop`, and `files`:

```ts
const client = createDesktopClient({
  product: "upload-smoke",
  apiBaseURL: server.baseURL,
  session,
  storage,
  secureStorage,
  desktop,
  files
});
```

The foundation repo includes a local demo smoke for this path:

```bash
pnpm smoke:multipart
```

## Proxy Settings

`client.proxy` is the desktop network proxy setting surface. In Tauri, it is backed by `desktop-core-rs` commands and affects foundation-owned HTTP paths that pass through the Rust core:

- `client.http.*`
- `client.files.downloadFile`
- `client.updates.checkForUpdate`
- `client.updates.downloadUpdate`

```ts
await client.proxy.setConfig({
  enabled: true,
  mode: "http",
  host: "127.0.0.1",
  port: 7890,
  username: "operator",
  password: "secret",
  bypass: ["localhost", "127.0.0.1", "*.internal.local"]
});

const config = await client.proxy.getConfig();
console.log(config.hasPassword); // true
console.log(config.password); // undefined

const result = await client.proxy.testConnection("https://api.example.com/health");
```

Supported modes:

- `none`: disables proxy use for foundation Rust HTTP requests.
- `system`: lets the platform/runtime proxy environment handle requests.
- `http`: uses `http://host:port`, with optional username/password.
- `socks5`: uses `socks5://host:port`, with optional username/password.

Proxy passwords are stored through the Rust secure storage adapter. `getConfig()` does not return the clear-text password; it returns `hasPassword` when a saved password exists. Browser-only clients expose the same API shape, but proxy settings do not alter browser networking.

## Link Proxy

`client.linkProxy` gives products one controlled place to request arbitrary links through the active bridge transport. The common desktop setup is gateway mode: the proxy service can be local, VPN-only, or intranet, while the final target URL is passed to that trusted gateway.

```ts
createDesktopClient({
  product: "product",
  apiBaseURL: "https://api.example.com",
  linkProxy: {
    mode: "gateway",
    proxyBaseURL: "http://127.0.0.1:17890/link-proxy"
  },
  security: {
    allowedLinkProxyOrigins: ["127.0.0.1", "localhost", "*.corp.local"]
  }
});

const reply = await client.linkProxy.request("https://vendor.example.com/status", {
  method: "GET",
  query: { source: "desktop" }
});
```

Gateway mode does not require `allowedLinkTargetOrigins` because the product-owned proxy can enforce target policy server-side. Add it when the client should narrow targets before hitting the proxy. Direct mode does require `allowedLinkTargetOrigins`, so the bridge cannot become an unbounded browser-side request surface. `auth` defaults to false; set `linkProxy.auth` or request-level `auth: true` only when the proxy gateway itself expects the product session token.

## Session And Storage

```ts
client.session.setToken(token, true);
client.storage.set("table.orders", { density: "compact" });
await client.secureStorage.set("refreshToken", token);
```

Use `storage` for preferences and non-sensitive local state. Use `secureStorage` for refresh tokens, private API keys, and secrets.

## Diagnostics And Audit Events

`client.diagnostics` keeps recent request logs and recent audit events in memory:

```ts
client.diagnostics.getRecentRequests();
client.diagnostics.clearRecentRequests();

client.diagnostics.getRecentAuditEvents();
client.diagnostics.clearRecentAuditEvents();
client.diagnostics.recordAuditEvent({
  action: "orders.export.requested",
  ok: true,
  metadata: { count: 12 }
});
```

Pass `onAuditEvent` or `auditObserver` to forward events to a product-owned audit/logging service:

```ts
createDesktopClient({
  product: "product",
  apiBaseURL: "https://api.example.com",
  onAuditEvent: (event) => reportAuditEvent(event),
  maxAuditEvents: 200
});
```

The bridge automatically records desktop/file/update/link-proxy failures and app-shell records login, logout, session-load failure, and access-denied events. See [Audit Events](audit-events.md).

## Locale Formatting And Missing Keys

`useLocale()` exposes translation and formatter helpers:

```tsx
const { t, format } = useLocale();

t("common.confirm");
format.currency(1280.5, "USD");
format.dateTime(Date.now());
```

`DesktopAppShell` passes i18n policy to `LocaleProvider`:

```tsx
<DesktopAppShell
  locale="en-US"
  messages={messages}
  dictionaries={dictionaries}
  formatDefaults={{ currency: "USD", timeZone: "America/New_York" }}
  onMissingLocaleKey={(event) => reportDiagnostic(event)}
/>
```

Use `getMissingLocaleKeys(reference, target)` for build-time checks when products own additional dictionaries.

## Desktop

```ts
await client.desktop.openExternal("https://docs.example.com");
await client.desktop.copyText("value");
await client.desktop.notify({ title: "Export complete" });
await client.desktop.setWindowTitle("Orders");
```

## Updates

`client.updates` is the shared app-update surface. By default it is inert unless the product provides `updateConfig`, a custom `updates` capability, or a Tauri updater adapter.

```ts
const check = await client.updates.checkForUpdate();
if (check.available) {
  await client.updates.openUpdatePage(check.update);
}
```

Products can keep release publishing in CI/CD or a local release script while rendering update status in the desktop client. Manifest checks use the active bridge HTTP transport when available, so Tauri clients can use the native command transport instead of WebView CORS-bound fetch. Manifest updates support `downloadUrl`, `sha256`, and `size`; when the active file capability returns a checksum, the bridge verifies it before marking the update as downloaded. Update downloads default to `auth: false`, which keeps product session tokens out of public release hosts.

`client.updates.installUpdate(update)` is adapter-backed. In Tauri clients created with `createTauriDesktopClient`, the manifest updater automatically uses `plugin:desktop-core|df_update_install` after a package is downloaded and verified. On macOS, `.zip` packages that contain a `.app` bundle and direct `.app` bundles are staged for replacement after the current app quits, with optional relaunch. `.pkg`, `.dmg`, and unsupported platform packages are opened with the system installer. Product UI can safely show check, release notes, download, checksum, and install status without implementing `.app` replacement or relaunch behavior in business pages.

`createTauriUpdateInstallAdapter` is exported from `@desktop-foundation/bridge` for products that assemble capabilities manually. It maps manifest metadata keys such as `targetPath`, `appName`, `relaunch`, and `backup` into the `df_update_install` request.

For custom installers or non-Tauri clients, wire an installer adapter at the client boundary, not inside a page component:

```ts
createDesktopClient({
  product: "admin",
  apiBaseURL: "https://api.example.com",
  version: "1.0.0",
  updateConfig: {
    manifestUrl: "https://releases.example.com/admin/latest.json",
    requireChecksumVerification: true,
    installUpdate: async ({ update, downloadedPath }) => {
      await installer.apply(downloadedPath, update.version);
      return { status: "installed", message: "Update installed. Restart the app." };
    }
  }
});
```

For GitHub Releases, use the config helper. It points `manifestUrl` at the release asset and validates the configured GitHub host before manifest load:

```ts
import { createGitHubReleasesUpdateConfig } from "@desktop-foundation/bridge";

createDesktopClient({
  product: "admin",
  version: "1.0.0",
  apiBaseURL: "https://api.example.com",
  updateConfig: createGitHubReleasesUpdateConfig({
    repository: "owner/repository",
    channel: "stable",
    requireChecksumVerification: true
  })
});
```

`createGitHubReleaseManifestUrl(config)` and `createGitHubReleasePageUrl(config)` are exported for products that only need URLs.

`createGitHubReleasesUpdateCapability(config, desktop, files)` is also exported for products that manually assemble capabilities and want the GitHub Releases manifest URL plus the standard manifest download/checksum/state flow in one adapter.

## Files

```ts
const result = await client.files.openFileDialog({ filters: [{ name: "CSV", extensions: ["csv"] }] });
await client.files.exportJson("orders.json", rows, { directory: "/tmp" });
await client.files.downloadFile("https://api.example.com/report", { directory: "/tmp" });
```

## Tauri Bootstrap

```ts
import { invoke } from "@tauri-apps/api/core";
import { createDesktopClient, createTauriDesktopClient } from "@desktop-foundation/bridge";

export async function createProductClient() {
  if ("__TAURI_INTERNALS__" in window) {
    return createTauriDesktopClient(invoke, clientConfig);
  }
  return createDesktopClient(clientConfig);
}
```

## Optional Native Tauri Plugins

`createTauriDesktopClient` can use product-owned Tauri plugins for the capabilities that already have official plugin coverage, while keeping the Rust command fallback for the rest of the foundation contract.

```ts
import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { open, save } from "@tauri-apps/plugin-dialog";
import { sendNotification } from "@tauri-apps/plugin-notification";
import { openUrl } from "@tauri-apps/plugin-opener";
import { createTauriDesktopClient, createTauriUpdaterPluginAdapters, type TauriNativePluginAdapters, type TauriUpdaterPluginModule } from "@desktop-foundation/bridge";

const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<unknown>;

async function createNativePlugins(): Promise<TauriNativePluginAdapters> {
  const plugins: TauriNativePluginAdapters = {
    openExternal: openUrl,
    copyText: writeText,
    notify: sendNotification,
    openFileDialog: open,
    saveFileDialog: save
  };

  if (import.meta.env.VITE_TAURI_UPDATER === "1") {
    const updater = await dynamicImport("@tauri-apps/plugin-updater") as TauriUpdaterPluginModule;
    Object.assign(plugins, createTauriUpdaterPluginAdapters(updater));
  }

  return plugins;
}

export async function createProductClient() {
  return createTauriDesktopClient(invoke, {
    ...clientConfig,
    nativePlugins: await createNativePlugins()
  });
}
```

The optional adapter currently covers:

- opener: `desktop.openExternal`
- clipboard manager: `desktop.copyText`
- notification: `desktop.notify`
- dialog: `files.openFileDialog`, `files.saveFileDialog`
- updater: `updates.checkForUpdate`, `updates.downloadUpdate`, `updates.installUpdate` through `createTauriUpdaterPluginAdapters` when the product enables and configures `@tauri-apps/plugin-updater`

HTTP, session, storage, secure storage, text file read/write, JSON export, file download, update install, and window state continue to use the foundation Rust command contract. Without the official updater plugin, manifest updates still support check, release notes, download, checksum verification, and the built-in `df_update_install` boundary; product pages must not replace `.app` files or relaunch directly.

## Rust Core

Use the Tauri feature for commands:

```toml
desktop-core-rs = { path = "../../../packages/desktop-core-rs", features = ["tauri", "http-reqwest"] }
```

Use platform adapters in products:

```rust
let core = DesktopCore::persistent_platform("product")?;
```

Command groups:

Tauri 2 products must grant the foundation plugin in their capability file:

```json
{
  "permissions": ["core:default", "desktop-core:default"]
}
```


- HTTP: `df_http_request`
- Session: `df_session_get`, `df_session_set`, `df_session_clear`
- Storage: `df_storage_get`, `df_storage_set`, `df_storage_remove`
- Secure storage: `df_secure_storage_get`, `df_secure_storage_set`, `df_secure_storage_remove`
- Desktop: `df_open_external`, `df_copy_text`, `df_notify`
- Files: `df_file_open_dialog`, `df_file_save_dialog`, `df_file_read_text`, `df_file_write_text`, `df_file_export_json`, `df_file_download`
- Window: `df_window_get_state`, `df_window_set_state`, `df_window_set_title`

## UI React

Component groups:

- Primitives: button, input, modal, drawer, tabs, toast, confirm, command palette.
- Forms: form field, row, section, file picker.
- Data: table, data table, editable table, pagination, filter bar, bulk action bar, metric grid.
- Layout: desktop layout, page header, content panel, settings section, settings page, detail drawer.
- Feedback: error state, offline banner, progress bar.
