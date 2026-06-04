#!/usr/bin/env node
import { get as httpsGet } from "node:https";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultManifest =
  "https://raw.githubusercontent.com/k2safe/desktop-foundation/main/artifacts/npm/foundation-packages.json";

const packages = [
  { name: "@desktop-foundation/bridge", dir: "packages/desktop-bridge" },
  { name: "@desktop-foundation/ui-react", dir: "packages/desktop-ui-react" },
  { name: "@desktop-foundation/app-shell", dir: "packages/desktop-app-shell" },
  { name: "@desktop-foundation/theme-presets", dir: "packages/theme-presets" },
  { name: "@desktop-foundation/create-desktop-app", dir: "packages/create-desktop-app" }
];

function parseArgs(argv) {
  const options = { manifest: defaultManifest };
  const args = [...argv];
  while (args.length) {
    const arg = args.shift();
    if (arg === "--") {
      continue;
    }
    if (arg === "--manifest") {
      options.manifest = args.shift() || options.manifest;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log("check-package-manifest-drift [--manifest URL_OR_PATH]");
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function readUrl(url) {
  return new Promise((resolvePromise, reject) => {
    httpsGet(url, (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        readUrl(response.headers.location).then(resolvePromise, reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to fetch manifest ${url}: HTTP ${response.statusCode}`));
        response.resume();
        return;
      }

      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        resolvePromise(JSON.parse(body));
      });
    }).on("error", reject);
  });
}

function parseVersion(version) {
  const [core, prerelease = ""] = String(version).split("-", 2);
  const parts = core.split(".").map((part) => Number.parseInt(part, 10));
  while (parts.length < 3) parts.push(0);
  if (parts.some((part) => Number.isNaN(part))) {
    throw new Error(`Unsupported version format: ${version}`);
  }
  return { parts, prerelease };
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let index = 0; index < 3; index += 1) {
    if (a.parts[index] !== b.parts[index]) {
      return a.parts[index] > b.parts[index] ? 1 : -1;
    }
  }
  if (a.prerelease === b.prerelease) return 0;
  if (!a.prerelease) return 1;
  if (!b.prerelease) return -1;
  return a.prerelease > b.prerelease ? 1 : -1;
}

async function readManifest(location) {
  if (/^https?:\/\//.test(location)) {
    return readUrl(location);
  }
  return readJson(resolve(repoRoot, location));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const manifest = await readManifest(options.manifest);
  const manifestByName = new Map((manifest.packages || []).map((entry) => [entry.name, entry]));
  const stale = [];
  const rootPackage = readJson(join(repoRoot, "package.json"));
  const capabilityRegistry = readJson(join(repoRoot, "packages/create-desktop-app/foundation-capabilities.json"));

  for (const item of packages) {
    const localPackage = readJson(join(repoRoot, item.dir, "package.json"));
    const manifestPackage = manifestByName.get(item.name);
    if (!manifestPackage) {
      stale.push(`${item.name}: missing from manifest`);
      continue;
    }

    const comparison = compareVersions(localPackage.version, manifestPackage.version);
    const marker = comparison === 0 ? "ok" : comparison > 0 ? "ahead" : "behind";
    console.log(`${item.name}: local ${localPackage.version}, manifest ${manifestPackage.version} (${marker})`);
    if (comparison < 0) {
      stale.push(`${item.name}: local ${localPackage.version} < manifest ${manifestPackage.version}`);
    }
  }

  if (!manifest.capabilities?.file) {
    stale.push("foundation-capabilities: missing from manifest");
  } else {
    console.log(`foundation-capabilities: manifest ${manifest.capabilities.file} (${manifest.capabilities.size || "unknown"} bytes)`);
  }
  if (capabilityRegistry.foundationVersion !== rootPackage.version) {
    stale.push(`foundation-capabilities: registry ${capabilityRegistry.foundationVersion} != root package ${rootPackage.version}`);
  }

  if (stale.length) {
    console.error("");
    console.error("Package manifest drift detected:");
    for (const line of stale) {
      console.error(`- ${line}`);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
