import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const html = readFileSync(resolve(root, "index.html"), "utf8");

const requiredClasses = [
  "df-desktop-layout",
  "df-page-header",
  "df-command-palette",
  "df-metric-grid",
  "df-bulk-action-bar",
  "df-table",
  "df-editable-table",
  "df-detail-drawer__list",
  "df-settings-page",
  "df-button",
  "data-visual-target=\"scroll-boundaries\"",
  "data-visual-target=\"wide-modal\"",
  "data-visual-target=\"long-modal\"",
  "data-visual-target=\"drawer-wide-table\"",
  "data-visual-target=\"compact-topbar\"",
  "data-visual-target=\"collapsed-sidebar\"",
  "docs-wide-modal",
  "docs-drawer-table-preview"
];

const missing = requiredClasses.filter((className) => !html.includes(className));
if (missing.length) {
  throw new Error(`Component docs fixture is missing: ${missing.join(", ")}`);
}

console.log("Component docs fixture is valid.");
