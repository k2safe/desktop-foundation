#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const options = {
    repo: "k2safe/desktop-foundation",
    tag: null,
    source: resolve(repoRoot, "artifacts/npm/foundation-packages.json"),
    output: resolve(repoRoot, "artifacts/npm/foundation-packages.release.json")
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      continue;
    } else if (arg === "--repo") {
      options.repo = argv[index + 1] || options.repo;
      index += 1;
    } else if (arg === "--tag") {
      options.tag = argv[index + 1] || options.tag;
      index += 1;
    } else if (arg === "--source") {
      options.source = resolve(argv[index + 1] || "");
      index += 1;
    } else if (arg === "--output") {
      options.output = resolve(argv[index + 1] || "");
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log("write-release-package-manifest --tag v0.1.25 [--repo owner/repo] [--source file] [--output file]");
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.tag) throw new Error("--tag is required");
  if (!/^[-._A-Za-z0-9/]+$/.test(options.repo)) throw new Error(`Invalid --repo: ${options.repo}`);
  if (!/^[-._A-Za-z0-9]+$/.test(options.tag)) throw new Error(`Invalid --tag: ${options.tag}`);
  return options;
}

function rewriteManifestUrls(manifest, baseUrl) {
  const nextManifest = JSON.parse(JSON.stringify(manifest));
  nextManifest.generatedAt = new Date().toISOString();
  nextManifest.baseUrl = baseUrl;
  nextManifest.releaseTag = baseUrl.split("/").at(-1);
  nextManifest.immutable = true;

  const packageUrls = new Map();
  for (const item of nextManifest.packages || []) {
    item.url = `${baseUrl}/${item.file}`;
    packageUrls.set(item.name, item.url);
  }

  for (const section of ["dependencies", "devDependencies"]) {
    for (const name of Object.keys(nextManifest.consumer?.[section] || {})) {
      const nextUrl = packageUrls.get(name);
      if (nextUrl) nextManifest.consumer[section][name] = nextUrl;
    }
  }

  for (const name of Object.keys(nextManifest.consumer?.pnpm?.overrides || {})) {
    const nextUrl = packageUrls.get(name);
    if (nextUrl) nextManifest.consumer.pnpm.overrides[name] = nextUrl;
  }

  return nextManifest;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const manifest = JSON.parse(await readFile(options.source, "utf8"));
  const baseUrl = `https://github.com/${options.repo}/releases/download/${options.tag}`;
  const releaseManifest = rewriteManifestUrls(manifest, baseUrl);

  await mkdir(dirname(options.output), { recursive: true });
  await writeFile(options.output, `${JSON.stringify(releaseManifest, null, 2)}\n`, "utf8");
  console.log(`release package manifest: wrote ${options.output}`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
