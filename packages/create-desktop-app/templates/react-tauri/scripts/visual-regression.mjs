#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const update = process.argv.includes("--update");
const strict = process.argv.includes("--strict");
const targetUrl = process.env.VISUAL_REGRESSION_URL;

function skip(message) {
  console.log(`[visual] skipped: ${message}`);
  process.exit(0);
}

if (!targetUrl) {
  skip("set VISUAL_REGRESSION_URL to the running product URL.");
}

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  skip("Playwright is not installed. Add it in the product repo, then run pnpm exec playwright install chromium.");
}

const root = process.cwd();
const baselineDir = path.join(root, "artifacts", "visual", "baseline");
const actualDir = path.join(root, "artifacts", "visual", "actual");
const baselinePath = path.join(baselineDir, "home.png");
const actualPath = path.join(actualDir, "home.png");

await fs.mkdir(baselineDir, { recursive: true });
await fs.mkdir(actualDir, { recursive: true });

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(targetUrl, { waitUntil: "networkidle" });
  await page.screenshot({ path: actualPath, fullPage: true });
} finally {
  await browser.close();
}

if (update) {
  await fs.copyFile(actualPath, baselinePath);
  console.log(`[visual] baseline updated: ${baselinePath}`);
  process.exit(0);
}

let baseline;
try {
  baseline = await fs.readFile(baselinePath);
} catch {
  if (strict) {
    console.error(`[visual] missing baseline: ${baselinePath}`);
    process.exit(1);
  }
  skip("baseline is missing. Run pnpm visual:regression:update after reviewing the first screenshot.");
}

const actual = await fs.readFile(actualPath);
if (!baseline.equals(actual)) {
  console.error(`[visual] screenshot differs from baseline. Actual: ${actualPath}`);
  process.exit(1);
}

console.log(`[visual] passed: ${actualPath}`);
