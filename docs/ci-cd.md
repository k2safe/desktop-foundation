# CI/CD Capability

The foundation does not force one CI/CD workflow onto product projects. It provides a small command wrapper and GitHub Actions examples; each product repository decides which checks to run and where to publish artifacts.

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

The wrapper only invokes package scripts. It does not install dependencies, publish releases, or decide artifact targets.

## GitHub Actions Example

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
      - run: pnpm exec desktop-foundation-ci --type-check --build

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
      - run: pnpm exec desktop-foundation-ci --no-type-check --no-build --visual
```

Projects that do not use Playwright can omit the `visual` job. Projects that opt in should own the `playwright` devDependency, browser install step, and committed screenshot baselines. Projects with release packaging can add their own Tauri build, signing, notarization, upload, or deployment jobs after `desktop-foundation-ci` passes.

## Update Capability

CI/CD can publish a manifest, but the desktop client owns how update information is shown to users. The bridge exposes `client.updates` so product UI can check, show, download, open release notes, or install through a native plugin adapter.

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
