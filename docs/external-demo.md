# External Demo

Use two GitHub repositories:

- `desktop-foundation`: the reusable foundation monorepo.
- `product-desktop-demo`: a standalone product-style demo that depends on released foundation packages.

## Why Two Demos

The monorepo keeps `examples/demo-product` as an internal regression demo. It uses `workspace:*` dependencies so foundation changes can be validated immediately.

The standalone `product-desktop-demo` should look like a real product project. It should not use `workspace:*`; it should consume released packages by version.

## Standalone Dependency Shape

After the foundation packages are released, the standalone demo should depend on versions:

```json
{
  "dependencies": {
    "@desktop-foundation/app-shell": "^0.1.0",
    "@desktop-foundation/bridge": "^0.1.0",
    "@desktop-foundation/theme-presets": "^0.1.0",
    "@desktop-foundation/ui-react": "^0.1.0",
    "react": "^19.0.1",
    "react-dom": "^19.0.1"
  }
}
```

If using GitHub Packages, the package scope must match the GitHub owner or organization. For the current package names, the cleanest GitHub Packages owner is `desktop-foundation`. If the repository lives under another owner, either publish to npm with the `@desktop-foundation` scope or rename the package scope to that owner.

## Release Readiness Checklist

Before the standalone demo can consume remote packages, the foundation packages need a publish pass:

- remove `private: true` from packages intended for release
- export built `dist` files instead of `src`
- include CSS files in package `files`
- replace internal `workspace:*` dependency ranges with package versions during publish
- tag releases, for example `v0.1.0`
- publish to npm or GitHub Packages

## Demo Project Shape

The standalone demo should copy the shape from `examples/demo-product`:

- `src/client.ts`: product bridge wiring
- `src/data.tsx`: product data models and table columns
- `src/theme.ts`: product theme override
- `src/screens/*`: dashboard, business page, settings page
- `src/App.tsx`: app shell, auth guard, login, navigation, command palette, debug panel

The standalone version can add Vite, Tauri, and CI without bringing those dependencies into the foundation monorepo.
