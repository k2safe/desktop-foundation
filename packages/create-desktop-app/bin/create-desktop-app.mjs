#!/usr/bin/env node
import { constants, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const templateRoot = join(packageRoot, "templates", "react-tauri");
const foundationPackageVersion =
  JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version || "0.0.0";
const themeTemplateIds = new Set(["default", "admin", "command", "topnav-ops", "merchant", "ledger", "studio", "dark"]);

const textExtensions = new Set([
  ".css",
  ".html",
  ".json",
  ".md",
  ".rs",
  ".toml",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml"
]);

function printHelp() {
  console.log(`create-desktop-app

Usage:
  create-desktop-app <target-dir> [options]

Options:
  --product <id>       Product id, used for package names and token keys.
  --app-name <name>    Human readable app name.
  --api-base <url>     Default API base URL.
  --template <id>      Theme template: default, admin, command, topnav-ops, merchant, ledger, studio, dark.
  --force              Allow generating into a non-empty directory.
  --help               Show this help.

Example:
  create-desktop-app apps/admin-desktop --product admin --app-name "Admin Desktop"
`);
}

function parseArgs(argv) {
  const args = [...argv];
  const options = {
    targetDir: "",
    product: "",
    appName: "",
    apiBase: "http://127.0.0.1:8891",
    template: "admin",
    force: false
  };

  while (args.length) {
    const arg = args.shift();
    if (!arg) continue;
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    if (arg === "--force") {
      options.force = true;
      continue;
    }
    if (arg === "--product") {
      options.product = args.shift() || "";
      continue;
    }
    if (arg === "--app-name") {
      options.appName = args.shift() || "";
      continue;
    }
    if (arg === "--api-base") {
      options.apiBase = args.shift() || "";
      continue;
    }
    if (arg === "--template") {
      options.template = args.shift() || "";
      continue;
    }
    if (!options.targetDir) {
      options.targetDir = arg;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!options.targetDir) {
    throw new Error("Missing target directory.");
  }

  const fallbackProduct = slugify(options.targetDir.split(/[\\/]/).filter(Boolean).pop() || "desktop-app");
  options.product = slugify(options.product || fallbackProduct);
  options.appName = options.appName || toTitle(options.product);
  options.template = slugify(options.template || "admin");
  if (!themeTemplateIds.has(options.template)) {
    throw new Error(`Unknown template: ${options.template}. Use one of: ${[...themeTemplateIds].join(", ")}.`);
  }
  return options;
}

function slugify(value) {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "desktop-app";
}

function toPascal(value) {
  return slugify(value)
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function toTitle(value) {
  return slugify(value)
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isTextFile(filePath) {
  return textExtensions.has(filePath.slice(filePath.lastIndexOf(".")));
}

function renderTemplate(value, replacements) {
  return value
    .replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key) => replacements[key] ?? "")
    .replace(/__RUST_PACKAGE_NAME__/g, replacements.RUST_PACKAGE_NAME ?? "");
}

function assertCanWrite(targetDir, force) {
  if (!existsSync(targetDir)) return;
  const files = readdirSync(targetDir).filter((name) => name !== ".DS_Store");
  if (files.length && !force) {
    throw new Error(`Target directory is not empty: ${targetDir}. Use --force to continue.`);
  }
}

function copyTemplate(sourceDir, targetDir, replacements) {
  mkdirSync(targetDir, { recursive: true });
  for (const name of readdirSync(sourceDir)) {
    const source = join(sourceDir, name);
    const renderedName = renderTemplate(name, replacements);
    const target = join(targetDir, renderedName);
    const stat = statSync(source);

    if (stat.isDirectory()) {
      copyTemplate(source, target, replacements);
      continue;
    }

    mkdirSync(dirname(target), { recursive: true });
    if (isTextFile(source)) {
      writeFileSync(target, renderTemplate(readFileSync(source, "utf8"), replacements));
    } else {
      copyFileSync(source, target, constants.COPYFILE_FICLONE);
    }
  }
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const targetDir = resolve(options.targetDir);
    const replacements = {
      APP_NAME: options.appName,
      PRODUCT_ID: options.product,
      PRODUCT_IDENTIFIER: options.product.replace(/-/g, "."),
      PACKAGE_NAME: `${options.product}-desktop`,
      RUST_PACKAGE_NAME: `${options.product.replace(/-/g, "_")}_desktop`,
      PASCAL_NAME: toPascal(options.product),
      API_BASE_URL: options.apiBase,
      THEME_TEMPLATE_ID: options.template,
      FOUNDATION_VERSION: foundationPackageVersion
    };

    assertCanWrite(targetDir, options.force);
    copyTemplate(templateRoot, targetDir, replacements);

    console.log(`Created ${replacements.APP_NAME} at ${relative(process.cwd(), targetDir) || "."}`);
    console.log("");
    console.log("Next steps:");
    console.log(`  cd ${relative(process.cwd(), targetDir) || "."}`);
    console.log("  pnpm install");
    console.log("  pnpm dev");
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    console.error("");
    printHelp();
    process.exit(1);
  }
}

main();
