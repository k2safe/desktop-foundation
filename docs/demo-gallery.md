# Demo Gallery

`examples/demo-gallery` is a type-checked component gallery for the foundation UI.

It intentionally avoids product-specific models and focuses on reusable UI surfaces:

- forms
- selectors
- date range picker
- modal
- drawer
- layout sections
- theme presets

`examples/component-docs` is a zero-dependency visual fixture:

- imports the shared `desktop-ui-react` stylesheet directly
- renders representative layout, table, command palette, drawer, settings, and editable table surfaces
- runs inside the workspace through `type-check`, `build`, and `lint`
- can be captured by `pnpm visual:regression` when Playwright is installed

`examples/desktop-capabilities` is a type-checked platform workflow demo:

- HTTP request
- secure storage
- file export and download
- notification
- clipboard
- command palette
- detail drawer
- settings page
- editable table

`examples/demo-product` is the standard product integration demo:

- product-style client wiring
- login and session flow
- desktop layout and navigation
- dashboard, orders, and settings screens
- command palette and debug panel
- file, notification, clipboard, storage, and diagnostics capability calls

Use this as the source shape for the standalone `desktop-foundation-demo` GitHub repository.
