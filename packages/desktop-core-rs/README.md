# desktop-core-rs

Rust core for desktop-foundation.

This crate defines the backend command contract used by Tauri desktop products.

## Scope

Included:

- HTTP request command shape
- session token commands
- key/value storage commands
- desktop/window/file/secure-storage command shapes
- unified error shape
- in-memory runtime for tests and early integration
- adapter traits for HTTP, desktop, file, and secure storage capabilities
- file-backed persistence for session/storage fallback
- platform adapters for clipboard, notification, open external, dialogs, exports, downloads, macOS Keychain, Linux Secret Service, and Windows DPAPI
- optional security allowlists for HTTP hosts, external hosts/schemes, and file roots
- `CurlHttpAdapter` for HTTPS/TLS transport and multipart upload without extra Rust TLS dependencies
- optional `http-reqwest` adapter

Not included:

- business API paths
- business payload models
- product-specific token keys
- product menu or permission semantics

## Tauri

The crate keeps core logic independent from Tauri. Enable the `tauri` feature to expose command handlers.
