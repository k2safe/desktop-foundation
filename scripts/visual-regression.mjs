#!/usr/bin/env node
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const update = process.argv.includes("--update");
const root = resolve(import.meta.dirname, "..");
const fixture = resolve(root, "examples/component-docs/index.html");
const outputDir = resolve(root, "examples/component-docs/__screenshots__");

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    return null;
  }
}

const playwright = await loadPlaywright();
if (!playwright) {
  console.log("Playwright is not installed; skipping visual screenshots.");
  console.log("Install it in CI or locally to enable screenshot capture.");
  process.exit(0);
}

if (!existsSync(fixture)) {
  throw new Error(`Missing component docs fixture: ${fixture}`);
}

mkdirSync(outputDir, { recursive: true });

const browser = await playwright.chromium.launch();
try {
  for (const viewport of [
    { name: "desktop", width: 1440, height: 1200 },
    { name: "mobile", width: 390, height: 1200 }
  ]) {
    const page = await browser.newPage({ viewport });
    await page.goto(pathToFileURL(fixture).toString());
    await page.screenshot({
      path: resolve(outputDir, `${viewport.name}.png`),
      fullPage: true
    });
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(update ? `Updated screenshots in ${outputDir}` : `Captured screenshots in ${outputDir}`);
