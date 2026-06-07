# Package Consumption

This page is the handoff contract for product repositories that need to consume `desktop-foundation` before a registry publish is available.

## Stable Path: GitHub Release Tarballs

For a stable product integration, use the immutable manifest attached to a GitHub Release. Current stable release:

```text
https://github.com/k2safe/desktop-foundation/releases/download/v0.1.37/foundation-packages.json
```

The package URLs inside that manifest point to the same release tag, for example:

```text
https://github.com/k2safe/desktop-foundation/releases/download/v0.1.37/desktop-foundation-bridge-0.1.37.tgz
```

This keeps product installs pinned to a specific foundation release even after `main` moves forward.

## Latest Pointer On Main

The foundation repo also keeps a copy of the latest package manifest on `main`. This file is a convenience pointer only; package tarball URLs inside it point at immutable GitHub Release assets.

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

The manifest also includes `capabilities.url`, which points to the machine-readable foundation capability registry for that same package build. External AI agents should read it after installing dependencies, then compare it with `desktop-foundation-ci --integration-check --integration-report`.

Use this Rust dependency in product `src-tauri/Cargo.toml`:

```toml
desktop-core-rs = { git = "ssh://git@github.com/k2safe/desktop-foundation.git", branch = "main", package = "desktop-core-rs", features = ["tauri", "http-reqwest"] }
```

## Generate Package Artifacts

From the foundation repo:

```bash
pnpm release:check-package-drift
pnpm build
pnpm pack:packages
```

`pnpm pack:packages` writes the latest Release-backed manifest and local tarball files:

- `artifacts/npm/*.tgz`
- `artifacts/npm/foundation-packages.json`
- `artifacts/npm/foundation-capabilities.json`

By default, package URLs use `https://github.com/k2safe/desktop-foundation/releases/download/v<version>/...`. Pass `--base-url` only when publishing to another stable artifact host.

To create an immutable release manifest:

```bash
pnpm release:package-manifest -- --tag v0.1.37 --output /tmp/foundation-packages.json
```

Upload the output as the release asset named `foundation-packages.json` next to the package tarballs and `foundation-capabilities.json`.

## Later: Registry Publish

The package manifests are publish-ready. When a registry is available, publish the current manifest package version to npm or GitHub Packages and replace the tarball URLs with normal semver ranges such as `<published-version>`.

The product integration shape stays the same.
