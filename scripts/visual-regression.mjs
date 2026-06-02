#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const update = process.argv.includes("--update");
const expanded = process.argv.includes("--expanded") || process.env.DESKTOP_FOUNDATION_VISUAL_EXPANDED === "1";
const strict = process.argv.includes("--strict") || process.env.DESKTOP_FOUNDATION_VISUAL_STRICT === "1";
const root = resolve(import.meta.dirname, "..");
const fixture = resolve(root, "examples/component-docs/index.html");
const outputDir = resolve(root, "examples/component-docs/__screenshots__");
const actualDir = resolve(outputDir, ".actual");

const baseTheme = {
  "--df-color-primary": "#0f766e",
  "--df-color-primary-hover": "#0d665f",
  "--df-color-primary-soft": "#dff7f1",
  "--df-color-dark": "#0f172a",
  "--df-color-bg": "#f3f6f8",
  "--df-color-surface": "#ffffff",
  "--df-color-elevated": "#ffffff",
  "--df-color-border": "#dde5ee",
  "--df-color-border-strong": "#b9c5d3",
  "--df-color-text": "#111827",
  "--df-color-text-muted": "#6b7280",
  "--df-color-danger": "#dc2626",
  "--df-color-warning": "#d97706",
  "--df-color-success": "#059669",
  "--df-color-info": "#2563eb",
  "--df-radius-sm": "6px",
  "--df-radius-md": "8px",
  "--df-radius-lg": "12px",
  "--df-radius-xl": "16px",
  "--df-shadow-sm": "0 1px 2px rgba(15, 23, 42, 0.06)",
  "--df-shadow-md": "0 10px 24px rgba(15, 23, 42, 0.10)",
  "--df-shadow-lg": "0 24px 60px rgba(15, 23, 42, 0.16)",
  "--df-font-sans": "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
  "--df-control-height": "40px",
  "--df-table-row-height": "52px"
};

const scenarios = [
  {
    id: "default",
    mode: "light",
    className: "df-theme df-template-default df-surface-crisp"
  },
  {
    id: "admin",
    mode: "light",
    className: "df-theme df-template-admin df-surface-dense"
  },
  {
    id: "command",
    mode: "light",
    className: "df-theme df-template-command df-surface-dense",
    tokens: {
      "--df-color-primary": "#2563eb",
      "--df-color-primary-hover": "#1d4ed8",
      "--df-color-primary-soft": "#e0f2fe",
      "--df-color-dark": "#07111f",
      "--df-color-bg": "#eef3f8",
      "--df-color-border": "#dbe5ef",
      "--df-control-height": "36px",
      "--df-table-row-height": "44px"
    }
  },
  {
    id: "merchant",
    mode: "light",
    className: "df-theme df-template-merchant df-surface-glass",
    tokens: {
      "--df-color-primary": "#7c3aed",
      "--df-color-primary-hover": "#6d28d9",
      "--df-color-primary-soft": "#ede9fe",
      "--df-color-dark": "#130f2d",
      "--df-color-bg": "#f6f4ff"
    }
  },
  {
    id: "ledger",
    mode: "light",
    className: "df-theme df-template-ledger df-surface-crisp",
    tokens: {
      "--df-color-primary": "#177e5f",
      "--df-color-primary-hover": "#10674d",
      "--df-color-primary-soft": "#e9f8f1",
      "--df-color-dark": "#0f1720",
      "--df-color-bg": "#f4f7f2",
      "--df-color-border": "#dfe7dc"
    }
  },
  {
    id: "studio",
    mode: "light",
    className: "df-theme df-template-studio df-surface-glass",
    tokens: {
      "--df-color-primary": "#365ac7",
      "--df-color-primary-hover": "#2947a3",
      "--df-color-primary-soft": "#edf2ff",
      "--df-color-dark": "#162033",
      "--df-color-bg": "#f6f7fb",
      "--df-control-height": "44px",
      "--df-table-row-height": "58px"
    }
  },
  {
    id: "dark",
    mode: "dark",
    className: "df-theme df-template-midnight df-surface-dense",
    tokens: {
      "--df-color-primary": "#8b5cf6",
      "--df-color-primary-hover": "#7c3aed",
      "--df-color-primary-soft": "#312e81",
      "--df-color-dark": "#020617",
      "--df-color-bg": "#0b1120",
      "--df-color-surface": "#111827",
      "--df-color-elevated": "#1f2937",
      "--df-color-border": "#334155",
      "--df-color-border-strong": "#475569",
      "--df-color-text": "#e5e7eb",
      "--df-color-text-muted": "#94a3b8"
    }
  }
];

const viewports = [
  { id: "desktop", width: 1440, height: 1200 },
  { id: "mobile", width: 390, height: 1200 }
];

const baseCaptureTargets = [
  { id: "page", label: "full page" }
];

const expandedCaptureTargets = [
  { id: "shells", label: "desktop shells", selector: '[data-visual-target="shells"]' },
  { id: "data", label: "table and bulk actions", selector: '[data-visual-target="data"]' },
  { id: "login-forms", label: "login and forms", selector: '[data-visual-target="login-forms"]' },
  { id: "modal", label: "modal", selector: '[data-visual-target="modal"]' }
];

const captureTargets = expanded ? [...baseCaptureTargets, ...expandedCaptureTargets] : baseCaptureTargets;

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    return null;
  }
}

const playwright = await loadPlaywright();
if (!playwright) {
  console.log("Playwright is not installed; skipping visual regression.");
  console.log("Install it in CI or locally to enable screenshot capture and baseline comparison.");
  process.exit(0);
}

if (!existsSync(fixture)) {
  throw new Error(`Missing component docs fixture: ${fixture}`);
}

mkdirSync(outputDir, { recursive: true });
mkdirSync(actualDir, { recursive: true });

let browser;
try {
  browser = await playwright.chromium.launch();
} catch (bundledBrowserError) {
  const fallbackChannel = process.env.DESKTOP_FOUNDATION_VISUAL_CHANNEL || "chrome";
  try {
    browser = await playwright.chromium.launch({ channel: fallbackChannel });
    console.log(`Using installed Chromium channel for visual regression: ${fallbackChannel}`);
  } catch (channelError) {
    const executablePath = process.env.DESKTOP_FOUNDATION_VISUAL_EXECUTABLE || (process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : undefined);
    if (executablePath && existsSync(executablePath)) {
      try {
        browser = await playwright.chromium.launch({ executablePath });
        console.log(`Using installed browser executable for visual regression: ${executablePath}`);
      } catch (executableError) {
        if (strict) throw executableError;
      }
    }
    if (!browser) {
      if (strict) throw channelError;
      console.log("Playwright browser is not installed; skipping visual regression.");
      console.log("Run pnpm exec playwright install chromium, set DESKTOP_FOUNDATION_VISUAL_CHANNEL, set DESKTOP_FOUNDATION_VISUAL_EXECUTABLE, or pass --strict in CI to fail on missing browsers.");
      process.exit(0);
    }
  }
}

const failures = [];
let captured = 0;

function compareScreenshot(actualPath, baselinePath, name) {
  if (update) {
    writeFileSync(baselinePath, readFileSync(actualPath));
    return;
  }

  if (!existsSync(baselinePath)) {
    const updateCommand = expanded ? "node scripts/visual-regression.mjs --expanded --update" : "node scripts/visual-regression.mjs --update";
    failures.push(`${name}: missing baseline, run ${updateCommand}`);
    return;
  }

  const actual = readFileSync(actualPath);
  const baseline = readFileSync(baselinePath);
  if (!actual.equals(baseline)) {
    failures.push(`${name}: screenshot differs`);
  }
}

try {
  for (const scenario of scenarios) {
    for (const viewport of viewports) {
      const page = await browser.newPage({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1
      });

      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.addInitScript(({ baseTheme, scenario }) => {
        window.__dfApplyVisualScenario = () => {
          const tokens = { ...baseTheme, ...(scenario.tokens ?? {}) };
          document.body.className = scenario.className;
          document.body.dataset.theme = scenario.mode;
          for (const [name, value] of Object.entries(tokens)) {
            document.body.style.setProperty(name, value);
          }
        };
      }, { baseTheme, scenario });

      await page.goto(pathToFileURL(fixture).toString());
      await page.evaluate(() => window.__dfApplyVisualScenario?.());
      for (const target of captureTargets) {
        const suffix = target.id === "page" ? "" : `-${target.id}`;
        const actualPath = join(actualDir, `${scenario.id}-${viewport.id}${suffix}.png`);
        const baselinePath = join(outputDir, `${scenario.id}-${viewport.id}${suffix}.png`);
        if (target.selector) {
          const locator = page.locator(target.selector);
          await locator.scrollIntoViewIfNeeded();
          await locator.screenshot({
            path: actualPath,
            animations: "disabled"
          });
        } else {
          await page.screenshot({
            path: actualPath,
            fullPage: true,
            animations: "disabled"
          });
        }
        compareScreenshot(actualPath, baselinePath, `${scenario.id}/${viewport.id}/${target.label}`);
        captured += 1;
      }
      await page.close();
    }
  }
} finally {
  await browser.close();
}

if (failures.length > 0) {
  console.error(`Visual regression found ${failures.length} issue(s). Actual screenshots are in ${actualDir}.`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

if (update) {
  console.log(`Updated ${captured} visual baselines in ${outputDir}`);
} else {
  console.log(`Visual regression passed for ${captured} screenshots.`);
}
