# Package Consumption

This page is the handoff contract for product repositories that need to consume `desktop-foundation` before a registry publish is available.

## Fast Path: GitHub Raw Tarballs

The foundation repo publishes package tarballs into `artifacts/npm`. Product apps can install them directly from GitHub raw URLs.

Manifest:

```text
https://raw.githubusercontent.com/k2safe/desktop-foundation/main/artifacts/npm/foundation-packages.json
```

Use the manifest as the source of truth. Copy these blocks from the current manifest into the product `package.json`:

```text
manifest.consumer.dependencies -> package.json dependencies
manifest.consumer.devDependencies -> package.json devDependencies
manifest.consumer.pnpm -> package.json pnpm
```

Use this Rust dependency in product `src-tauri/Cargo.toml`:

```toml
desktop-core-rs = { git = "ssh://git@github.com/k2safe/desktop-foundation.git", branch = "main", package = "desktop-core-rs", features = ["tauri"] }
```

## Generate Package Artifacts

From the foundation repo:

```bash
pnpm release:check-package-drift
pnpm build
pnpm pack:packages
```

`pnpm pack:packages` writes:

- `artifacts/npm/*.tgz`
- `artifacts/npm/foundation-packages.json`

## Later: Registry Publish

The package manifests are publish-ready. When a registry is available, publish the current manifest package version to npm or GitHub Packages and replace the tarball URLs with normal semver ranges such as `<published-version>`.

The product integration shape stays the same.
