#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultArtifactDir = "artifacts/npm";
const defaultBaseUrl = "https://raw.githubusercontent.com/k2safe/desktop-foundation/main/artifacts/npm";

const packages = [
  { name: "@desktop-foundation/bridge", dir: "packages/desktop-bridge", section: "dependencies" },
  { name: "@desktop-foundation/ui-react", dir: "packages/desktop-ui-react", section: "dependencies" },
  { name: "@desktop-foundation/app-shell", dir: "packages/desktop-app-shell", section: "dependencies" },
  { name: "@desktop-foundation/theme-presets", dir: "packages/theme-presets", section: "dependencies" },
  { name: "@desktop-foundation/create-desktop-app", dir: "packages/create-desktop-app", section: "devDependencies" }
];

function parseArgs(argv) {
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

  const manifest = {
    generatedAt: new Date().toISOString(),
    repository: "git@github.com:k2safe/desktop-foundation.git",
    branch: "main",
    baseUrl: options.baseUrl,
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
