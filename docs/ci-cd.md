# CI/CD Capability

The foundation does not force one release workflow onto product projects. It ships a small command wrapper, artifact normalizer, update-manifest writer, and GitHub Actions templates. Product repositories still decide when to run them and where to publish the files.

## Command Wrapper

`@desktop-foundation/create-desktop-app` exposes:

```bash
desktop-foundation-ci
```

Default behavior runs the product package scripts `type-check` and `build` when they exist. Product projects can opt into more checks:

```bash
desktop-foundation-ci --lint --visual
desktop-foundation-ci --no-build --script smoke
desktop-foundation-ci --all --strict
```

The wrapper invokes product package scripts first. Packaging and manifest generation are opt-in so teams can compose their own release flow.

## Integration Check

When a product starts consuming the foundation, run the static integration contract check:

```bash
pnpm exec desktop-foundation-ci --integration-check --integration-summary --integration-report artifacts/foundation-integration.json
```

The check verifies package pins, pnpm overrides, shared stylesheet import, `DesktopAppShell`, theme template runtime, product adapter usage, copied-source risk, table/overlay overflow risk, login shell usage, Tauri `desktop-core-rs`, capabilities, update configuration, and expected scripts. Missing contract items fail; optional rollout items such as visual baselines or update manifest wiring are reported as warnings.

For a CI gate that should fail on warnings as well, add `--strict` after the product has intentionally resolved or accepted every warning.

## Desktop Artifact Normalization

After a Tauri build, normalize output into a predictable directory:

```bash
pnpm tauri build
pnpm exec desktop-foundation-ci \
  --no-type-check \
  --no-build \
  --package-desktop \
  --manifest \
  --release-plan \
  --github-repo owner/repository \
  --channel stable \
  --notes v1.0.0
```

On macOS this produces:

- `artifacts/desktop/<Product Name>.app` for local inspection.
- `artifacts/desktop/<product>-<version>-macos.zip` for GitHub Releases or updater download.
- `artifacts/desktop/latest.json` for update checks, including `sha256` and `size` when a release archive exists.
- `artifacts/desktop/<archive>.sha256` for manual checksum inspection.
- `artifacts/desktop/release-plan.json` when `--release-plan` is passed. It lists upload assets and a `gh release create` argument array.
- `artifacts/desktop/desktop-artifacts.json` for CI metadata.

For local previews that must not collide with an installed app using the same bundle id, add:

```bash
pnpm exec desktop-foundation-ci \
  --no-type-check \
  --no-build \
  --package-desktop \
  --preview-bundle-id com.example.product.preview \
  --preview-name "Product Desktop Preview"
```

The preview app is ad-hoc signed and has a distinct macOS bundle id, which avoids LaunchServices opening an older installed app.

## Local Release Without Actions

Actions are optional. When quota is unavailable, build and normalize on a local macOS machine:

```bash
pnpm release:local-check
```

This is the foundation repo's local release gate. It runs package manifest drift detection, multipart upload smoke, clean external demo smoke, package build/type-check, and Rust tests. The external demo smoke uses a local artifact server during this gate, so it can verify newly packed tarballs before those files are pushed to GitHub raw. Treat a green local gate as the replacement for GitHub Actions while quota is unavailable.

```bash
pnpm tauri build
pnpm exec desktop-foundation-ci \
  --no-type-check \
  --no-build \
  --package-desktop \
  --manifest \
  --release-plan \
  --download-base-url https://github.com/owner/repository/releases/download/v1.0.0 \
  --release-url https://github.com/owner/repository/releases/tag/v1.0.0
```

Upload the files listed in `artifacts/desktop/release-plan.json` to GitHub Releases manually, or run the generated `ghReleaseCreate` command array as a local script. The client only needs a reachable `latest.json`; it does not care whether the file was produced by Actions or by a local build.

Signing and notarization remain product-owned. The wrapper supports `--signing-identity` for macOS codesign identity selection and records a notarization placeholder in `release-plan.json`, so products can insert Apple notarization before upload without changing update UI code.

When `--github-repo owner/repo` is provided, the wrapper infers:

- `downloadUrl`: `https://github.com/owner/repo/releases/download/<tag>/<artifact>`
- `releasePageUrl`: `https://github.com/owner/repo/releases/tag/<tag>`
- `latestManifestUrl`: `https://github.com/owner/repo/releases/latest/download/latest.json`
- `ghReleaseCreate` and `ghReleaseUpload` command arrays

Additional release switches:

```bash
pnpm exec desktop-foundation-ci \
  --no-type-check \
  --no-build \
  --package-desktop \
  --manifest \
  --release-plan \
  --github-repo owner/repository \
  --draft \
  --signature-path artifacts/desktop/product.sig \
  --notarization-note "Notarize zip before upload"
```

## GitHub Actions Example

Generated React/Tauri projects include `.github/workflows/desktop-release.yml`. The workflow verifies on Ubuntu, builds macOS on `macos-14`, runs `desktop-foundation-ci --package-desktop --manifest --release-plan`, and uploads `artifacts/desktop` as a workflow artifact. It is intentionally artifact-only: teams can keep it as a manual build workflow, or add their own release upload/signing/notarization steps around `artifacts/desktop/release-plan.json`.

A smaller verification-only workflow looks like this:

```yaml
name: desktop-foundation

on:
  pull_request:
  push:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9.15.4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec desktop-foundation-ci --type-check --build --strict

  visual:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9.15.4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm exec desktop-foundation-ci --no-type-check --no-build --visual --strict
```

Projects that do not use Playwright can omit the visual job. Generated projects already include optional `visual:regression` scripts that skip until `VISUAL_REGRESSION_URL` is set. Projects that opt in should own the Playwright devDependency, browser install step, and committed screenshot baselines.

## Update Capability

CI/CD or a local build can publish `latest.json`, but the desktop client owns how update information is shown to users. The bridge exposes `client.updates` so product UI can check, show, download, verify checksum/size, open release notes, or install through a native plugin adapter. Manifest checks use the active bridge HTTP transport when available; Tauri products therefore go through `desktop-core` HTTP instead of relying on WebView CORS.

```ts
const result = await client.updates.checkForUpdate();
if (result.available) {
  await client.updates.openUpdatePage(result.update);
}
```

A manifest can be generated by `desktop-foundation-ci --manifest` and should look like this:

```json
{
  "version": "1.0.1",
  "channel": "stable",
  "downloadUrl": "https://github.com/owner/repository/releases/download/v1.0.1/product-1.0.1-macos.zip",
  "sha256": "...",
  "size": 12345678
}
```

For a simple manifest flow:

```ts
import { createGitHubReleasesUpdateConfig } from '@desktop-foundation/bridge';

createDesktopClient({
  product: 'product',
  version: '1.0.0',
  apiBaseURL: 'https://api.example.com',
  updateConfig: createGitHubReleasesUpdateConfig({
    repository: 'owner/repository',
    channel: 'stable',
    requireChecksumVerification: true,
    installUpdate: async ({ update, downloadedPath }) => {
      await nativeInstaller.apply(downloadedPath, update.version);
      return { status: 'installed', message: 'Update installed. Restart the app.' };
    }
  })
});
```

`downloadUpdate` defaults to `auth: false`, so public GitHub Releases or static manifest hosts do not receive product session tokens. If a private update server requires auth, pass `client.updates.downloadUpdate(update, { auth: true })` from product UI.

`installUpdate` is intentionally an adapter boundary. Without `updateConfig.installUpdate`, the manifest updater moves a verified package to `installable` and returns a message telling the product to provide an installer. Product UI can ship with check, release notes, download, and checksum status first. Do not implement direct `.app` replacement, `/Applications` file mutation, or relaunch behavior in business pages. Products that use Tauri updater can pass adapters through `nativePlugins`; after that, the UI still calls `client.updates`. See [Tauri Updater Adapter](tauri-updater-adapter.md) for the concrete adapter shape.
