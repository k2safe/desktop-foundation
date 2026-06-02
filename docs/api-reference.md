# API Reference

## TypeScript Bridge

`createDesktopClient(config)` returns a product-scoped client:

- `client.http.get/post/put/patch/delete`
- `client.session`
- `client.storage`
- `client.secureStorage`
- `client.desktop`
- `client.files`
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
- `responseType`: `json`, `text`, or `base64`
- `timeoutMs`
- `signal`
- `auth`
- `requestId`
- `namespace`

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

Products can keep release publishing in CI/CD or a local release script while rendering update status in the desktop client. Manifest updates support `downloadUrl`, `sha256`, and `size`; when the active file capability returns a checksum, the bridge verifies it before marking the update as downloaded. Update downloads default to `auth: false`, which keeps product session tokens out of public release hosts.

`client.updates.installUpdate(update)` is adapter-backed. Manifest updates expose `installable`, `installing`, and `installed` states, but the product decides how to apply the package:

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
import { createTauriDesktopClient } from "@desktop-foundation/bridge";

export async function createProductClient() {
  return createTauriDesktopClient(invoke, {
    ...clientConfig,
    nativePlugins: {
      openExternal: openUrl,
      copyText: writeText,
      notify: sendNotification,
      openFileDialog: open,
      saveFileDialog: save
    }
  });
}
```

The optional adapter currently covers:

- opener: `desktop.openExternal`
- clipboard manager: `desktop.copyText`
- notification: `desktop.notify`
- dialog: `files.openFileDialog`, `files.saveFileDialog`

HTTP, session, storage, secure storage, text file read/write, JSON export, file download, and window state continue to use the foundation Rust command contract.

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
