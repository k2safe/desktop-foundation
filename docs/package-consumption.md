# Package Consumption

This page is the handoff contract for product repositories that need to consume `desktop-foundation` before a registry publish is available.

## Stable Path: GitHub Release Tarballs

For a stable product integration, use the immutable manifest attached to a GitHub Release. Current stable release:

```text
https://github.com/k2safe/desktop-foundation/releases/download/v0.1.24/foundation-packages.json
```

The package URLs inside that manifest point to the same release tag, for example:

```text
https://github.com/k2safe/desktop-foundation/releases/download/v0.1.24/desktop-foundation-bridge-0.1.24.tgz
```

This keeps product installs pinned to a specific foundation release even after `main` moves forward.

## Development Path: GitHub Raw Tarballs

The foundation repo also publishes package tarballs into `artifacts/npm` on `main`. Product apps can install them directly from GitHub raw URLs when they intentionally want to track the latest committed manifest.

Manifest:

```text
https://raw.githubusercontent.com/k2safe/desktop-foundation/main/artifacts/npm/foundation-packages.json
```

Use either manifest as the source of truth. Copy these blocks from the selected manifest into the product `package.json`:

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

To create an immutable release manifest:

```bash
pnpm release:package-manifest -- --tag v0.1.24 --output /tmp/foundation-packages.json
```

Upload the output as the release asset named `foundation-packages.json` next to the package tarballs.

## Later: Registry Publish

The package manifests are publish-ready. When a registry is available, publish the current manifest package version to npm or GitHub Packages and replace the tarball URLs with normal semver ranges such as `<published-version>`.

The product integration shape stays the same.
