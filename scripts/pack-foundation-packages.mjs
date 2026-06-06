#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultArtifactDir = "artifacts/npm";
const defaultRepo = "k2safe/desktop-foundation";

const packages = [
  { name: "@desktop-foundation/bridge", dir: "packages/desktop-bridge", section: "dependencies" },
  { name: "@desktop-foundation/ui-react", dir: "packages/desktop-ui-react", section: "dependencies" },
  { name: "@desktop-foundation/app-shell", dir: "packages/desktop-app-shell", section: "dependencies" },
  { name: "@desktop-foundation/theme-presets", dir: "packages/theme-presets", section: "dependencies" },
  { name: "@desktop-foundation/create-desktop-app", dir: "packages/create-desktop-app", section: "devDependencies" }
];

function parseArgs(argv) {
  const rootPackageJson = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"));
  const defaultBaseUrl = `https://github.com/${defaultRepo}/releases/download/v${rootPackageJson.version}`;
  const options = { artifactDir: defaultArtifactDir, baseUrl: defaultBaseUrl };
  const args = [...argv];
  while (args.length) {
    const arg = args.shift();
    if (arg === "--artifact-dir") {
      options.artifactDir = args.shift() || options.artifactDir;
      continue;
    }
    if (arg === "--base-url") {
      options.baseUrl = (args.shift() || options.baseUrl).replace(/\/$/, "");
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log("pack-foundation-packages [--artifact-dir artifacts/npm] [--base-url URL]");
      console.log(`Default base URL: ${defaultBaseUrl}`);
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit", shell: false });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
}

function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const artifactDir = resolve(repoRoot, options.artifactDir);
  mkdirSync(artifactDir, { recursive: true });

  const dependencies = {};
  const devDependencies = {};
  const pnpmOverrides = {};
  const packageEntries = [];
  const capabilityRegistryFile = "foundation-capabilities.json";
  const capabilityRegistrySource = resolve(repoRoot, "packages/create-desktop-app", capabilityRegistryFile);
  const capabilityRegistryTarget = join(artifactDir, capabilityRegistryFile);

  for (const item of packages) {
    const packageDir = resolve(repoRoot, item.dir);
    const packageJson = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8"));
    run("pnpm", ["pack", "--pack-destination", artifactDir], packageDir);

    const fileName = `${packageJson.name.replace(/^@/, "").replace(/\//g, "-")}-${packageJson.version}.tgz`;
    const tarballPath = join(artifactDir, fileName);
    if (!existsSync(tarballPath)) {
      throw new Error(`Expected tarball was not created: ${tarballPath}`);
    }

    const url = `${options.baseUrl}/${fileName}`;
    if (item.section === "devDependencies") {
      devDependencies[item.name] = url;
    } else {
      dependencies[item.name] = url;
    }
    pnpmOverrides[item.name] = url;

    packageEntries.push({
      name: item.name,
      version: packageJson.version,
      file: fileName,
      path: relative(repoRoot, tarballPath),
      url,
      sha256: sha256(tarballPath),
      size: statSync(tarballPath).size
    });
  }

  copyFileSync(capabilityRegistrySource, capabilityRegistryTarget);
  const capabilityRegistry = {
    file: capabilityRegistryFile,
    path: relative(repoRoot, capabilityRegistryTarget),
    url: `${options.baseUrl}/${capabilityRegistryFile}`,
    sha256: sha256(capabilityRegistryTarget),
    size: statSync(capabilityRegistryTarget).size
  };

  const manifest = {
    generatedAt: new Date().toISOString(),
    repository: "git@github.com:k2safe/desktop-foundation.git",
    branch: "main",
    baseUrl: options.baseUrl,
    capabilities: capabilityRegistry,
    packages: packageEntries,
    consumer: {
      dependencies,
      devDependencies,
      pnpm: { overrides: pnpmOverrides },
      cargo: {
        dependency:
          'desktop-core-rs = { git = "ssh://git@github.com/k2safe/desktop-foundation.git", branch = "main", package = "desktop-core-rs", features = ["tauri"] }'
      }
    }
  };
  if (/^https:\/\/github\.com\/[-._A-Za-z0-9]+\/[-._A-Za-z0-9]+\/releases\/download\/v[-._A-Za-z0-9]+$/.test(options.baseUrl)) {
    manifest.releaseTag = options.baseUrl.split("/").at(-1);
    manifest.immutable = true;
  }

  const manifestPath = join(artifactDir, "foundation-packages.json");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`desktop-foundation-packages: wrote ${relative(repoRoot, manifestPath)}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
