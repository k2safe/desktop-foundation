# Component Docs

Zero-dependency component documentation fixture for `desktop-foundation`.

Open `index.html` directly in a browser to inspect the core UI surfaces. The page imports `packages/desktop-ui-react/src/styles.css` and uses representative foundation class names, so it is useful for fast visual smoke checks without pulling in Storybook or a bundler.

Optional screenshot workflow:

```bash
node scripts/visual-regression.mjs --update
```

Run from the repository root. If Playwright is installed, screenshots are written to `examples/component-docs/__screenshots__`.
