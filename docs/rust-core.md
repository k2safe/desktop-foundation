# Rust Core

`desktop-core-rs` defines the Rust/Tauri command contract for desktop products.

## Crate

```toml
[dependencies]
desktop-core-rs = { path = "../../../packages/desktop-core-rs", features = ["tauri"] }
```

## Tauri Setup

```rust
use desktop_core_rs::tauri_commands::desktop_core_plugin;
use desktop_core_rs::{CurlHttpAdapter, DesktopCore};
use std::sync::Arc;

fn main() {
    let core = DesktopCore::persistent_platform_with_http_adapter(
        "product",
        Arc::new(CurlHttpAdapter),
    )
    .expect("failed to initialize desktop core");

    tauri::Builder::default()
        .manage(core)
        .plugin(desktop_core_plugin())
        .run(tauri::generate_context!())
        .expect("failed to run desktop app");
}
```

## Commands

- `df_http_request`
- `df_session_get`
- `df_session_set`
- `df_session_clear`
- `df_storage_get`
- `df_storage_set`
- `df_storage_remove`
- `df_open_external`
- `df_copy_text`
- `df_notify`
- `df_file_open_dialog`
- `df_file_save_dialog`
- `df_file_read_text`
- `df_file_write_text`
- `df_file_export_json`
- `df_file_download`
- `df_secure_storage_get`
- `df_secure_storage_set`
- `df_secure_storage_remove`
- `df_window_get_state`
- `df_window_set_state`
- `df_window_set_title`

When registered as the `desktop-core` plugin, TypeScript can invoke them through names such as:

- `plugin:desktop-core|df_open_external`
- `plugin:desktop-core|df_copy_text`
- `plugin:desktop-core|df_notify`

`@desktop-foundation/bridge` exports `createTauriHttpTransport` and `createTauriDesktopCapability` for this command contract.

For Tauri 2 products, enable the plugin permission set in `src-tauri/capabilities/default.json`:

```json
{
  "permissions": ["core:default", "desktop-core:default"]
}
```

The scaffold includes this by default. Products with tighter policies can replace `desktop-core:default` with specific generated permissions such as `desktop-core:allow-df-file-download`.

It also exports `createTauriDesktopClient`, which wires:

- Rust HTTP command transport
- Rust session command store
- Rust storage command write-through cache
- Rust secure storage commands
- Rust desktop/window commands
- Rust file dialog, text file, JSON export, and download commands

Products can pass `nativePlugins` to `createTauriDesktopClient` when they prefer official Tauri plugins for opener, clipboard, notification, and dialog behavior. Those adapters replace only the matching frontend capability methods; the Rust core command contract remains the fallback and still owns HTTP, session, storage, secure storage, file download, and window commands.

## Platform Capabilities

Use `DesktopCore::persistent_platform_with_http_adapter` in product apps. It wires:

- system open external URL
- system clipboard copy
- system notification
- file open/save dialog fallback through OS tools
- text file read/write
- JSON export into Downloads/Documents/app-data
- HTTP-backed file download
- macOS Keychain secure storage
- Linux Secret Service secure storage through `secret-tool`
- Windows user-bound DPAPI secure storage through PowerShell-protected files
- file fallback for unsupported secure storage environments

`StorageScope::Secure` is routed to the secure storage adapter and is excluded from the normal file persistence state.

HTTP supports:

- default bearer token injection by namespace
- `timeoutMs`
- query values as strings, numbers, and booleans
- JSON, text, and base64 response modes
- base64 request bodies for binary upload style calls
- request id propagation

The scaffold uses `CurlHttpAdapter` by default because it gives HTTPS/TLS support without forcing every generated product to pull a Rust TLS stack. Teams that want an embedded Rust HTTP client can enable `http-reqwest` and inject `ReqwestHttpAdapter`.

## Security Policy

`SecurityPolicy` can gate direct Rust/Tauri command access:

```rust
let core = DesktopCore::persistent_platform_with_http_adapter("product", Arc::new(CurlHttpAdapter))?
    .with_security_policy(SecurityPolicy {
        allowed_http_hosts: vec!["api.example.com".into()],
        allowed_external_hosts: vec!["docs.example.com".into()],
        allowed_external_schemes: vec!["https".into()],
        allowed_file_roots: vec!["/Users/me/Downloads".into()],
    });
```

This protects HTTP requests, external URLs, file reads/writes, exports, and downloads even when a command is invoked directly.

## Boundary

Rust core owns local capability contracts and safe storage boundaries.

It does not own:

- product API paths
- product payload models
- product permissions
- product menus
- product route rules

The in-memory runtime is still available for tests and non-platform integration. Product shells should use the platform constructor so real desktop capabilities are available immediately.

`DesktopCore::persistent` and `DesktopCore::with_persistence_path` provide a cross-platform file-backed fallback for session and storage state.

## Adapters

`DesktopCore` accepts adapters:

- `HttpAdapter`
- `DesktopAdapter`
- `FileAdapter`
- `SecureStorageAdapter`

The default runtime uses no-op/recording adapters for tests. Products can enable `http-reqwest`, inject `ReqwestHttpAdapter`, and use the platform constructor while preserving the same public command contract.

## Formatting And Checks

Rust validation commands:

```bash
cargo test --offline
cargo check -p desktop-core-rs --features tauri,http-reqwest --offline
cargo fmt --check
```

`cargo fmt --check` requires the Rust `rustfmt` component:

```bash
rustup component add rustfmt
```
