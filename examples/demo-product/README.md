# Product Integration Demo

`examples/demo-product` is the standard generic product integration demo for `desktop-foundation`.

It is intentionally structured like a real business desktop project:

- `client.ts`: product client wiring, mocked transport, storage, secure storage, desktop, and file capabilities.
- `data.ts`: product-owned data models and fixture data.
- `theme.ts`: product theme override.
- `screens/*`: product screens composed from foundation UI.
- `App.tsx`: app shell, session, login, layout, navigation, command palette, and debug panel.

Inside this monorepo it uses `workspace:*` dependencies. In the standalone GitHub demo, switch those dependencies to released package versions.
