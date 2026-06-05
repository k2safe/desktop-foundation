#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageFiles = [
  "desktop-foundation-bridge",
  "desktop-foundation-ui-react",
  "desktop-foundation-app-shell",
  "desktop-foundation-theme-presets",
  "desktop-foundation-create-desktop-app"
];

function parseArgs(argv) {
  const options = {
    version: "",
    repo: "k2safe/desktop-foundation",
    proxy: process.env.PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY || "",
    manifest: ""
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
    if (arg === "--proxy") {
      options.proxy = argv[++index] || "";
      continue;
    }
    if (arg === "--manifest") {
      options.manifest = argv[++index] || "";
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log("release-verify --version 0.1.35 [--repo owner/repo] [--proxy http://127.0.0.1:10900]");
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!/^\d+\.\d+\.\d+(?:[-._A-Za-z0-9]+)?$/.test(options.version)) {
    throw new Error("--version is required and must look like 0.1.35");
  }
  if (!/^[-._A-Za-z0-9]+\/[-._A-Za-z0-9]+$/.test(options.repo)) {
    throw new Error(`Invalid --repo: ${options.repo}`);
  }
  return options;
}

function curlJson(url, options) {
  const args = ["-fsSL", "--retry", "3", "--retry-connrefused", "--retry-delay", "2", "--max-time", "60"];
  if (options.proxy) args.push("--proxy", options.proxy);
  if (process.env.GH_TOKEN) args.push("-H", `Authorization: Bearer ${process.env.GH_TOKEN}`);
  args.push(url);

  const result = spawnSync("curl", args, { encoding: "utf8", cwd: repoRoot, shell: false });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `curl failed: ${url}`);
  }
  return JSON.parse(result.stdout);
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function localAsset(path) {
  const fullPath = resolve(repoRoot, path);
  assert(existsSync(fullPath), `Missing local asset: ${path}`);
  return { fullPath, size: statSync(fullPath).size, sha256: sha256(fullPath) };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const tag = `v${options.version}`;
  const baseUrl = `https://github.com/${options.repo}/releases/download/${tag}`;
  const release = curlJson(`https://api.github.com/repos/${options.repo}/releases/tags/${tag}`, options);
  assert(release.tag_name === tag, `Release tag mismatch: ${release.tag_name}`);

  const expectedAssets = [
    "foundation-packages.json",
    "foundation-capabilities.json",
    ...packageFiles.map((name) => `${name}-${options.version}.tgz`)
  ];
  const assetsByName = new Map((release.assets || []).map((asset) => [asset.name, asset]));
  for (const name of expectedAssets) {
    assert(assetsByName.has(name), `Missing GitHub Release asset: ${name}`);
  }

  const manifestUrl = options.manifest || `${baseUrl}/foundation-packages.json`;
  const manifest = curlJson(manifestUrl, options);
  assert(manifest.immutable === true, "Release manifest must be immutable");
  assert(manifest.releaseTag === tag, `Release manifest tag mismatch: ${manifest.releaseTag}`);
  assert(manifest.baseUrl === baseUrl, `Release manifest baseUrl mismatch: ${manifest.baseUrl}`);
  assert(manifest.capabilities?.url === `${baseUrl}/foundation-capabilities.json`, "Capability URL must point at the release asset");

  const manifestPackages = new Map((manifest.packages || []).map((item) => [item.file, item]));
  for (const name of packageFiles) {
    const file = `${name}-${options.version}.tgz`;
    const item = manifestPackages.get(file);
    assert(item, `Manifest missing package file: ${file}`);
    assert(item.version === options.version, `${file} version mismatch: ${item.version}`);
    assert(item.url === `${baseUrl}/${file}`, `${file} URL must point at the release asset`);

    const local = localAsset(`artifacts/npm/${file}`);
    assert(item.size === local.size, `${file} manifest size mismatch`);
    assert(item.sha256 === local.sha256, `${file} manifest sha256 mismatch`);

    const remoteAsset = assetsByName.get(file);
    assert(remoteAsset?.size === local.size, `${file} GitHub asset size mismatch`);
  }

  for (const section of ["dependencies", "devDependencies"]) {
    for (const [name, url] of Object.entries(manifest.consumer?.[section] || {})) {
      assert(String(url).startsWith(baseUrl), `${section}.${name} must point at ${baseUrl}`);
    }
  }
  for (const [name, url] of Object.entries(manifest.consumer?.pnpm?.overrides || {})) {
    assert(String(url).startsWith(baseUrl), `pnpm.overrides.${name} must point at ${baseUrl}`);
  }

  console.log(`release-verify: ${tag} ok`);
  console.log(release.html_url);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
