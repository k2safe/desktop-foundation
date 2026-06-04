# External Demo

Use two GitHub repositories:

- `desktop-foundation`: the reusable foundation monorepo.
- `product-desktop-demo`: a standalone product-style demo that depends on released foundation packages.

## Why Two Demos

The monorepo keeps `examples/demo-product` as an internal regression demo. It uses `workspace:*` dependencies so foundation changes can be validated immediately.

The standalone `product-desktop-demo` should look like a real product project. It should not use `workspace:*`; it should consume released packages by version.

## Standalone Dependency Shape

After the foundation packages are released, the standalone demo should depend on the published package version:

```json
{
  "dependencies": {
    "@desktop-foundation/app-shell": "^<published-version>",
    "@desktop-foundation/bridge": "^<published-version>",
    "@desktop-foundation/theme-presets": "^<published-version>",
    "@desktop-foundation/ui-react": "^<published-version>",
    "react": "^19.0.1",
    "react-dom": "^19.0.1"
  }
}
```

Before a registry publish is available, copy `consumer.dependencies`, `consumer.devDependencies`, and `consumer.pnpm.overrides` from `artifacts/npm/foundation-packages.json` instead of using semver ranges.

If using GitHub Packages, the package scope must match the GitHub owner or organization. For the current package names, the cleanest GitHub Packages owner is `desktop-foundation`. If the repository lives under another owner, either publish to npm with the `@desktop-foundation` scope or rename the package scope to that owner.

## Release Readiness Checklist

Before the standalone demo can consume remote packages, the foundation packages need a publish pass:

- remove `private: true` from packages intended for release
- export built `dist` files instead of `src`
- include CSS files in package `files`
- replace internal `workspace:*` dependency ranges with package versions during publish
- tag releases, for example `v<published-version>`
- publish to npm or GitHub Packages

## Demo Project Shape

The standalone demo should copy the shape from `examples/demo-product`:

- `src/client.ts`: product bridge wiring
- `src/data.tsx`: product data models and table columns
- `src/theme.ts`: product theme override
- `src/screens/*`: dashboard, business page, settings page
- `src/App.tsx`: app shell, auth guard, login, navigation, command palette, debug panel

The standalone version can add Vite, Tauri, and CI without bringing those dependencies into the foundation monorepo.

## Clean External Smoke

Before handing the foundation to an outside AI, validate it in a fresh directory outside this monorepo. The demo must consume only the GitHub manifest tarballs and the Git Cargo dependency from `artifacts/npm/foundation-packages.json`.

Minimum smoke:

```bash
pnpm smoke:external-ai-demo
```

The script creates a temporary product project, installs the GitHub tarball dependencies from the manifest, runs integration-check, builds the Vite app, and verifies a local `FormData` upload through a mock server. To inspect the generated project after the run:

```bash
pnpm smoke:external-ai-demo -- --keep
```

To verify an immutable release manifest directly:

```bash
pnpm smoke:external-ai-demo -- --manifest https://github.com/k2safe/desktop-foundation/releases/download/v0.1.26/foundation-packages.json
```

Before pushing a new version's tarballs to GitHub raw, use local artifact mode:

```bash
pnpm smoke:external-ai-demo -- --local-artifacts
```

`pnpm release:local-check` uses local artifact mode so the release gate can pass before the new tarballs exist on `main`.

The manual equivalent is:

```bash
pnpm install
pnpm exec desktop-foundation-ci --integration-check --integration-report artifacts/foundation-integration.json
pnpm build
pnpm upload:smoke
```

If the product exposes file upload, add a local mock upload smoke that posts browser `FormData` through `client.http.post`. The mock server should assert that it receives `multipart/form-data` with a generated boundary and the expected fields/files. For Node/headless smoke, pass memory/noop adapters into `createDesktopClient`; do not rely on browser defaults such as `window.localStorage`.

For a real product rollout, wire `onAuditEvent` or `auditObserver` in the generated client and forward audit events to the product logging service. The internal demo logs audit events locally so the DebugPanel audit tab and integration-check can be exercised without a backend.
