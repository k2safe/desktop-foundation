# Package Consumption

This page is the handoff contract for product repositories that need to consume `desktop-foundation` before a registry publish is available.

## Fast Path: GitHub Raw Tarballs

The foundation repo publishes package tarballs into `artifacts/npm`. Product apps can install them directly from GitHub raw URLs.

Manifest:

```text
https://raw.githubusercontent.com/k2safe/desktop-foundation/main/artifacts/npm/foundation-packages.json
```

Use these dependencies in product `package.json`:

```json
{
  "dependencies": {
    "@desktop-foundation/app-shell": "https://raw.githubusercontent.com/k2safe/desktop-foundation/main/artifacts/npm/desktop-foundation-app-shell-0.1.11.tgz",
    "@desktop-foundation/bridge": "https://raw.githubusercontent.com/k2safe/desktop-foundation/main/artifacts/npm/desktop-foundation-bridge-0.1.11.tgz",
    "@desktop-foundation/theme-presets": "https://raw.githubusercontent.com/k2safe/desktop-foundation/main/artifacts/npm/desktop-foundation-theme-presets-0.1.11.tgz",
    "@desktop-foundation/ui-react": "https://raw.githubusercontent.com/k2safe/desktop-foundation/main/artifacts/npm/desktop-foundation-ui-react-0.1.11.tgz"
  },
  "devDependencies": {
    "@desktop-foundation/create-desktop-app": "https://raw.githubusercontent.com/k2safe/desktop-foundation/main/artifacts/npm/desktop-foundation-create-desktop-app-0.1.11.tgz"
  },
  "pnpm": {
    "overrides": {
      "@desktop-foundation/app-shell": "https://raw.githubusercontent.com/k2safe/desktop-foundation/main/artifacts/npm/desktop-foundation-app-shell-0.1.11.tgz",
      "@desktop-foundation/bridge": "https://raw.githubusercontent.com/k2safe/desktop-foundation/main/artifacts/npm/desktop-foundation-bridge-0.1.11.tgz",
      "@desktop-foundation/theme-presets": "https://raw.githubusercontent.com/k2safe/desktop-foundation/main/artifacts/npm/desktop-foundation-theme-presets-0.1.11.tgz",
      "@desktop-foundation/ui-react": "https://raw.githubusercontent.com/k2safe/desktop-foundation/main/artifacts/npm/desktop-foundation-ui-react-0.1.11.tgz",
      "@desktop-foundation/create-desktop-app": "https://raw.githubusercontent.com/k2safe/desktop-foundation/main/artifacts/npm/desktop-foundation-create-desktop-app-0.1.11.tgz"
    }
  }
}
```

Use this Rust dependency in product `src-tauri/Cargo.toml`:

```toml
desktop-core-rs = { git = "ssh://git@github.com/k2safe/desktop-foundation.git", branch = "main", package = "desktop-core-rs", features = ["tauri"] }
```

## Generate Package Artifacts

From the foundation repo:

```bash
pnpm build
pnpm pack:packages
```

`pnpm pack:packages` writes:

- `artifacts/npm/*.tgz`
- `artifacts/npm/foundation-packages.json`

## Later: Registry Publish

The package manifests are publish-ready. When a registry is available, publish the same packages to npm or GitHub Packages and replace the tarball URLs with normal semver ranges such as `0.1.11`.

The product integration shape stays the same.
