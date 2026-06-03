# Security Policy

The foundation provides security hooks in both TypeScript and Rust.

## TypeScript Policy

Configure `DesktopClientConfig.security`:

```ts
createDesktopClient({
  product: "product",
  apiBaseURL: "https://api.example.com",
  security: {
    allowedRequestOrigins: ["api.example.com"],
    allowedExternalOrigins: ["docs.example.com"],
    allowedExternalSchemes: ["https"],
    allowedDownloadDirectories: ["/Users/me/Downloads"],
    allowedLinkProxyOrigins: ["127.0.0.1", "localhost", "*.corp.local"],
    allowedLinkTargetOrigins: ["*.trusted-vendor.com"]
  }
});
```

Rules:

- `allowedRequestOrigins` gates `client.http` and `client.files.downloadFile`.
- `allowedExternalOrigins` gates `client.desktop.openExternal`.
- `allowedExternalSchemes` blocks unsafe schemes unless explicitly allowed.
- `allowedDownloadDirectories` gates file dialog directories, exports, writes, and downloads.
- `allowedLinkProxyOrigins` gates the proxy gateway used by `client.linkProxy`; this may intentionally include local, VPN, or intranet hosts.
- `allowedLinkTargetOrigins` optionally narrows final link targets in gateway mode and is required for direct mode.

Origins can be exact hosts, full origins, wildcard host suffixes such as `*.example.com`, or `*`.

## Rust Policy

Rust commands can be protected with `SecurityPolicy`:

```rust
let core = DesktopCore::persistent_platform_with_http_adapter("product", Arc::new(CurlHttpAdapter))?
    .with_security_policy(SecurityPolicy {
        allowed_http_hosts: vec!["api.example.com".into()],
        allowed_external_hosts: vec!["docs.example.com".into()],
        allowed_external_schemes: vec!["https".into()],
        allowed_file_roots: vec!["/Users/me/Downloads".into()],
    });
```

Rust policy prevents direct Tauri command invocation from bypassing product allowlists.

## Sensitive Data

- Do not put access tokens in `storage`.
- Use `secureStorage` or `StorageScope::Secure`.
- `StorageScope::Secure` is excluded from normal file persistence.
- Request diagnostics store method, URL, duration, status, and normalized errors only.

## Platform Notes

- macOS secure storage uses Keychain.
- Linux secure storage uses Secret Service through `secret-tool` when available.
- Windows secure storage uses user-bound DPAPI through PowerShell-protected files.
- File dialogs use OS-native command surfaces where available and report a clear unavailable error otherwise.
