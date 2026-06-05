#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJsonPaths = [
  "package.json",
  "packages/desktop-bridge/package.json",
  "packages/desktop-ui-react/package.json",
  "packages/desktop-app-shell/package.json",
  "packages/theme-presets/package.json",
  "packages/create-desktop-app/package.json"
];
const capabilityRegistryPath = "packages/create-desktop-app/foundation-capabilities.json";
const releaseDocPaths = [
  "docs/capabilities.md",
  "docs/update-center-integration.md",
  "docs/external-ai-acceptance.md",
  "docs/external-demo.md",
  "docs/package-consumption.md",
  "docs/product-ai-handoff.md"
];

function parseArgs(argv) {
  const options = {
    version: "",
    repo: "k2safe/desktop-foundation",
    build: true,
    pack: true,
    check: true
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (arg === "--version") {
      options.version = argv[++index] || "";
      continue;
    }
    if (arg === "--repo") {
      options.repo = argv[++index] || options.repo;
      continue;
    }
    if (arg === "--no-build") {
      options.build = false;
      continue;
    }
    if (arg === "--no-pack") {
      options.pack = false;
      continue;
    }
    if (arg === "--no-check") {
      options.check = false;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log("release-prepare --version 0.1.36 [--repo owner/repo] [--no-build] [--no-pack] [--no-check]");
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!/^\d+\.\d+\.\d+(?:[-._A-Za-z0-9]+)?$/.test(options.version)) {
    throw new Error("--version is required and must look like 0.1.36");
  }
  if (!/^[-._A-Za-z0-9]+\/[-._A-Za-z0-9]+$/.test(options.repo)) {
    throw new Error(`Invalid --repo: ${options.repo}`);
  }
  return options;
}

function readText(path) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

function writeText(path, text) {
  writeFileSync(resolve(repoRoot, path), text, "utf8");
}

function writeJson(path, update) {
  const fullPath = resolve(repoRoot, path);
  const json = JSON.parse(readFileSync(fullPath, "utf8"));
  update(json);
  writeFileSync(fullPath, `${JSON.stringify(json, null, 2)}\n`, "utf8");
}

function replaceReleaseReferences(path, version, repo) {
  const tag = `v${version}`;
  let text = readText(path);
  const releasePrefix = `https://github.com/${repo}/releases/download/`;
  text = text.replace(
    new RegExp(`${releasePrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}v[-._A-Za-z0-9]+`, "g"),
    `${releasePrefix}${tag}`
  );
  text = text.replace(/desktop-foundation-(bridge|ui-react|app-shell|theme-presets|create-desktop-app)-\d+\.\d+\.\d+(?:[-._A-Za-z0-9]+)?\.tgz/g, (match, name) => {
    return `desktop-foundation-${name}-${version}.tgz`;
  });
  text = text.replace(/release:package-manifest -- --tag v[-._A-Za-z0-9]+/g, `release:package-manifest -- --tag ${tag}`);
  text = text.replace(/"foundationVersion": "\d+\.\d+\.\d+(?:[-._A-Za-z0-9]+)?"/g, `"foundationVersion": "${version}"`);
  writeText(path, text);
}

function run(command, args) {
  console.log(`$ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { cwd: repoRoot, stdio: "inherit", shell: false });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const today = new Date().toISOString().slice(0, 10);
  const tag = `v${options.version}`;

  for (const path of packageJsonPaths) {
    writeJson(path, (json) => {
      json.version = options.version;
    });
  }

  writeJson(capabilityRegistryPath, (json) => {
    json.foundationVersion = options.version;
    json.updatedAt = today;
  });

  for (const path of releaseDocPaths) {
    replaceReleaseReferences(path, options.version, options.repo);
  }

  if (options.build) run("pnpm", ["build"]);
  if (options.pack) run("pnpm", ["pack:packages"]);
  if (options.pack) run("pnpm", ["release:package-manifest", "--", "--tag", tag, "--repo", options.repo]);
  if (options.check) run("pnpm", ["release:check-package-drift", "--", "--manifest", "artifacts/npm/foundation-packages.json"]);
  if (options.check) run("git", ["diff", "--check"]);

  console.log(`release-prepare: ready for ${tag}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
