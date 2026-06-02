# Component Docs

Zero-dependency component documentation fixture for `desktop-foundation`.

Open `index.html` directly in a browser to inspect the core UI surfaces. The page imports `packages/desktop-ui-react/src/styles.css` and uses representative foundation class names, so it is useful for fast visual smoke checks without pulling in Storybook or a bundler.

Optional screenshot workflow:

```bash
pnpm visual:regression:update
pnpm visual:regression
```

Run from the repository root. With Playwright installed, `visual:regression:update` writes baselines for every built-in template at desktop and mobile widths. `visual:regression` captures actual screenshots into `examples/component-docs/__screenshots__/.actual` and compares them with the committed baselines. Without Playwright, the script exits successfully and reports that visual capture was skipped.
