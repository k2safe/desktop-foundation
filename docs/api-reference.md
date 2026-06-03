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
- `updateConfig`
- `linkProxy`
- `version`
- `security`
- `requestObserver`
- `onUnauthorized`
- `defaultHeaders`
- `maxRequestLogEntries`

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

Desktop HTTP supports browser `FormData` for multipart upload. In a Tauri client, the bridge serializes `FormData` into the Rust command contract and the default `CurlHttpAdapter` generates the multipart boundary:

```ts
const form = new FormData();
form.append("release", "0.1.20");
form.append("package", zipFile);

await client.http.post("/releases", form);
```

Do not set `Content-Type: multipart/form-data` manually for `FormData` uploads; the transport owns the boundary. For non-browser callers, use `multipart.fields` and `multipart.files` with file `bodyBase64`.

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

`client.updates.installUpdate(update)` is adapter-backed. Manifest updates expose `installable`, `installing`, and `installed` states, but the real installer must be provided through a product-owned adapter. Product UI can safely show check, release notes, download, and checksum status before an installer exists; do not implement direct `.app` replacement or relaunch behavior in business pages.

When an installer adapter is ready, wire it at the client boundary, not inside a page component:

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

HTTP, session, storage, secure storage, text file read/write, JSON export, file download, and window state continue to use the foundation Rust command contract. Without the updater plugin, manifest updates still support check, release notes, download, and checksum verification; product pages must not replace `.app` files or relaunch directly.

## Rust Core

Use the Tauri feature for commands:

```toml
desktop-core-rs = { path = "../../../packages/desktop-core-rs", features = ["tauri"] }
```

Use platform adapters in products:

```rust
let core = DesktopCore::persistent_platform_with_http_adapter(
    "product",
    Arc::new(CurlHttpAdapter),
);
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
