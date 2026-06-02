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

## Desktop Artifact Normalization

After a Tauri build, normalize output into a predictable directory:

```bash
pnpm tauri build
pnpm exec desktop-foundation-ci \
  --no-type-check \
  --no-build \
  --package-desktop \
  --manifest \
  --channel stable \
  --download-base-url https://github.com/acme/admin/releases/download/v1.0.0 \
  --release-url https://github.com/acme/admin/releases/tag/v1.0.0 \
  --notes v1.0.0
```

On macOS this produces:

- `artifacts/desktop/<Product Name>.app` for local inspection.
- `artifacts/desktop/<product>-<version>-macos.zip` for GitHub Releases or updater download.
- `artifacts/desktop/latest.json` for update checks.
- `artifacts/desktop/desktop-artifacts.json` for CI metadata.

For local previews that must not collide with an installed app using the same bundle id, add:

```bash
pnpm exec desktop-foundation-ci \
  --no-type-check \
  --no-build \
  --package-desktop \
  --preview-bundle-id com.acme.admin.preview \
  --preview-name "Acme Admin Preview"
```

The preview app is ad-hoc signed and has a distinct macOS bundle id, which avoids LaunchServices opening an older installed app.

## GitHub Actions Example

Generated React/Tauri projects include `.github/workflows/desktop-release.yml`. The workflow verifies on Ubuntu, builds macOS on `macos-14`, runs `desktop-foundation-ci --package-desktop --manifest`, and uploads `artifacts/desktop` as a workflow artifact. Teams can keep that as an artifact-only workflow, or add their own release upload/signing/notarization steps.

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

Projects that do not use Playwright can omit the visual job. Projects that opt in should own the Playwright devDependency, browser install step, and committed screenshot baselines.

## Update Capability

CI/CD can publish `latest.json`, but the desktop client owns how update information is shown to users. The bridge exposes `client.updates` so product UI can check, show, download, open release notes, or install through a native plugin adapter.

```ts
const result = await client.updates.checkForUpdate();
if (result.available) {
  await client.updates.openUpdatePage(result.update);
}
```

For a simple manifest flow:

```ts
createDesktopClient({
  product: 'admin',
  version: '1.0.0',
  apiBaseURL: 'https://api.example.com',
  updateConfig: {
    manifestUrl: 'https://releases.example.com/admin/latest.json',
    channel: 'stable'
  }
});
```

For Tauri updater, product apps pass adapters through `nativePlugins`; the UI still calls `client.updates`.
