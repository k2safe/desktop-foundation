#!/usr/bin/env node
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const knownChecks = ["type-check", "build", "lint", "visual:regression"];
const defaultArtifactDir = "artifacts/desktop";

function printHelp() {
  console.log([
    "desktop-foundation-ci",
    "",
    "Usage:",
    "  desktop-foundation-ci [options]",
    "",
    "Checks:",
    "  --type-check          Run the package type-check script.",
    "  --build               Run the package build script.",
    "  --lint                Run the package lint script.",
    "  --visual              Run the package visual:regression script.",
    "  --all                 Run type-check, lint, build, and visual:regression.",
    "  --script <name>       Run an additional package script. Can be repeated.",
    "  --no-type-check       Disable the default type-check step.",
    "  --no-build            Disable the default build step.",
    "  --strict              Fail when a requested script or package artifact is missing.",
    "",
    "Desktop packaging:",
    "  --package-desktop     Normalize built desktop artifacts into artifacts/desktop.",
    "  --app-path <path>     Explicit app/bundle path to package.",
    "  --artifact-dir <dir>  Output directory. Defaults to artifacts/desktop.",
    "  --product-name <name> Override product name from tauri.conf.json/package.json.",
    "  --version <version>   Override version from tauri.conf.json/package.json.",
    "  --no-zip              Skip zip creation for directory-style bundles.",
    "  --preview-bundle-id <id>  Create a macOS preview .app with a distinct bundle id.",
    "  --preview-name <name>     Display name for the preview .app.",
    "",
    "Update manifest:",
    "  --manifest            Write an update manifest JSON next to artifacts.",
    "  --manifest-path <path> Manifest output path. Defaults to <artifact-dir>/latest.json.",
    "  --channel <name>      Release channel. Defaults to stable.",
    "  --download-url <url>  Download URL placed in the manifest.",
    "  --download-base-url <url> Build downloadUrl from base URL plus zip file name.",
    "  --release-url <url>   Release notes page URL.",
    "  --notes <text>        Release notes placed in the manifest.",
    "  --mandatory           Mark the update as mandatory.",
    "",
    "Other:",
    "  --help                Show this help.",
    "",
    "Default:",
    "  desktop-foundation-ci runs type-check and build when those scripts exist. Packaging and manifest steps are opt-in."
  ].join("\n"));
}

function readNext(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error("Missing value for " + flag + ".");
  return value;
}

function parseArgs(argv) {
  const options = {
    requested: new Set(["type-check", "build"]),
    customScripts: [],
    strict: false,
    packageDesktop: false,
    artifactDir: defaultArtifactDir,
    manifest: false,
    channel: "stable",
    mandatory: false,
    zip: true
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    if (arg === "--all") {
      for (const check of knownChecks) options.requested.add(check);
      continue;
    }
    if (arg === "--type-check") {
      options.requested.add("type-check");
      continue;
    }
    if (arg === "--build") {
      options.requested.add("build");
      continue;
    }
    if (arg === "--lint") {
      options.requested.add("lint");
      continue;
    }
    if (arg === "--visual") {
      options.requested.add("visual:regression");
      continue;
    }
    if (arg === "--no-type-check") {
      options.requested.delete("type-check");
      continue;
    }
    if (arg === "--no-build") {
      options.requested.delete("build");
      continue;
    }
    if (arg === "--strict") {
      options.strict = true;
      continue;
    }
    if (arg === "--script") {
      options.customScripts.push(readNext(argv, index, arg));
      index += 1;
      continue;
    }
    if (arg === "--package-desktop" || arg === "--package") {
      options.packageDesktop = true;
      continue;
    }
    if (arg === "--app-path") {
      options.appPath = readNext(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--artifact-dir") {
      options.artifactDir = readNext(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--product-name") {
      options.productName = readNext(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--version") {
      options.version = readNext(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--no-zip") {
      options.zip = false;
      continue;
    }
    if (arg === "--preview-bundle-id") {
      options.previewBundleId = readNext(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--preview-name") {
      options.previewName = readNext(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--manifest") {
      options.manifest = true;
      continue;
    }
    if (arg === "--manifest-path") {
      options.manifestPath = readNext(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--channel") {
      options.channel = readNext(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--download-url") {
      options.downloadUrl = readNext(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--download-base-url") {
      options.downloadBaseUrl = readNext(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--release-url") {
      options.releaseUrl = readNext(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--notes") {
      options.notes = readNext(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--mandatory") {
      options.mandatory = true;
      continue;
    }
    throw new Error("Unknown argument: " + arg);
  }

  return options;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readPackageJson() {
  const packagePath = resolve(process.cwd(), "package.json");
  if (!existsSync(packagePath)) {
    throw new Error("Missing package.json in " + process.cwd());
  }
  return readJson(packagePath);
}

function readTauriConfig() {
  const configPath = resolve(process.cwd(), "src-tauri", "tauri.conf.json");
  return existsSync(configPath) ? readJson(configPath) : null;
}

function detectRunner(packageManager = "") {
  const agent = packageManager || process.env.npm_config_user_agent || "";
  if (agent.startsWith("pnpm@")) return { command: "pnpm", argsFor: (script) => [script] };
  if (agent.startsWith("yarn@")) return { command: "yarn", argsFor: (script) => [script] };
  if (agent.startsWith("bun@")) return { command: "bun", argsFor: (script) => ["run", script] };
  return { command: "npm", argsFor: (script) => ["run", script] };
}

function runScript(script, packageJson, runner, strict) {
  if (!packageJson.scripts?.[script]) {
    const message = "desktop-foundation-ci: missing package script \"" + script + "\"";
    if (strict) throw new Error(message);
    console.log(message + "; skipped.");
    return;
  }

  console.log("desktop-foundation-ci: running " + script);
  const result = spawnSync(runner.command, runner.argsFor(script), {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: false,
    env: { ...process.env, DESKTOP_FOUNDATION_CI: "1" }
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error("desktop-foundation-ci: script \"" + script + "\" failed with exit code " + result.status);
  }
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? process.cwd(),
    stdio: options.stdio ?? "inherit",
    shell: false
  });
  if (result.error) {
    if (options.optional) return false;
    throw result.error;
  }
  if (result.status !== 0) {
    if (options.optional) return false;
    throw new Error(command + " " + args.join(" ") + " failed with exit code " + result.status);
  }
  return true;
}

function safeSegment(value) {
  return String(value || "desktop-app")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "desktop-app";
}

function displayName(value) {
  return String(value || "Desktop App").replace(/^@[^/]+\//, "");
}

function inferProductName(options, packageJson, tauriConfig) {
  return options.productName ?? tauriConfig?.productName ?? packageJson.productName ?? displayName(packageJson.name);
}

function inferVersion(options, packageJson, tauriConfig) {
  return options.version ?? tauriConfig?.version ?? packageJson.version ?? "0.0.0";
}

function findMacApp() {
  const macosDir = resolve(process.cwd(), "src-tauri", "target", "release", "bundle", "macos");
  if (!existsSync(macosDir)) return null;
  const apps = readdirSync(macosDir).filter((item) => item.endsWith(".app"));
  return apps.length ? join(macosDir, apps[0]) : null;
}

function findPackagedArtifact(options) {
  if (options.appPath) return resolve(process.cwd(), options.appPath);
  const macApp = findMacApp();
  if (macApp) return macApp;
  return null;
}

function isDirectory(path) {
  return existsSync(path) && statSync(path).isDirectory();
}

function removePlistKey(plistPath, key) {
  runCommand("/usr/libexec/PlistBuddy", ["-c", "Delete :" + key, plistPath], { optional: true, stdio: "ignore" });
}

function setPlistString(plistPath, key, value) {
  const setOk = runCommand("/usr/libexec/PlistBuddy", ["-c", "Set :" + key + " " + value, plistPath], { optional: true, stdio: "ignore" });
  if (!setOk) {
    runCommand("/usr/libexec/PlistBuddy", ["-c", "Add :" + key + " string " + value, plistPath], { stdio: "ignore" });
  }
}

function fixMacosApp(appPath, overrides = {}) {
  if (process.platform !== "darwin" || !appPath.endsWith(".app")) return;
  const plistPath = join(appPath, "Contents", "Info.plist");
  if (!existsSync(plistPath)) return;
  for (const key of ["LSRequiresCarbon", "CSResourcesFileMapped"]) removePlistKey(plistPath, key);
  if (overrides.bundleId) setPlistString(plistPath, "CFBundleIdentifier", overrides.bundleId);
  if (overrides.displayName) {
    setPlistString(plistPath, "CFBundleDisplayName", overrides.displayName);
    setPlistString(plistPath, "CFBundleName", overrides.displayName);
  }
  runCommand("codesign", ["--force", "--deep", "--sign", "-", appPath]);
  runCommand("codesign", ["--verify", "--deep", "--strict", "--verbose=2", appPath]);
}

function copyBundle(source, target) {
  mkdirSync(dirname(target), { recursive: true });
  if (isDirectory(source)) {
    cpSync(source, target, { recursive: true, force: true });
  } else {
    copyFileSync(source, target);
  }
}

function createZipForBundle(bundlePath, artifactDir, zipName) {
  const zipPath = join(artifactDir, zipName);
  const bundleName = basename(bundlePath);
  if (process.platform === "darwin") {
    runCommand("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", bundleName, zipPath], { cwd: artifactDir });
    return zipPath;
  }
  const ok = runCommand("zip", ["-qry", zipPath, bundleName], { cwd: artifactDir, optional: true });
  return ok ? zipPath : null;
}

function makeDownloadUrl(baseUrl, fileName) {
  if (!baseUrl || !fileName) return undefined;
  return baseUrl.replace(/\/$/, "") + "/" + encodeURIComponent(fileName).replace(/%2F/g, "/");
}

function packageDesktopArtifacts(options, packageJson, tauriConfig) {
  const sourcePath = findPackagedArtifact(options);
  if (!sourcePath || !existsSync(sourcePath)) {
    const message = "desktop-foundation-ci: no desktop artifact found. Run tauri build first or pass --app-path.";
    if (options.strict) throw new Error(message);
    console.log(message + " skipped.");
    return null;
  }

  const productName = inferProductName(options, packageJson, tauriConfig);
  const version = inferVersion(options, packageJson, tauriConfig);
  const artifactDir = resolve(process.cwd(), options.artifactDir);
  const platform = process.platform === "darwin" ? "macos" : process.platform;
  const ext = extname(sourcePath) || (isDirectory(sourcePath) ? ".app" : "");
  const baseName = safeSegment(productName) + "-" + version + "-" + platform;
  const appName = sourcePath.endsWith(".app") ? productName + ".app" : baseName + ext;
  const appPath = join(artifactDir, appName);

  mkdirSync(artifactDir, { recursive: true });
  copyBundle(sourcePath, appPath);
  fixMacosApp(appPath);

  let zipPath = null;
  if (options.zip && isDirectory(appPath)) {
    zipPath = createZipForBundle(appPath, artifactDir, baseName + ".zip");
  }

  let previewAppPath = null;
  if (options.previewBundleId && process.platform === "darwin" && appPath.endsWith(".app")) {
    const previewName = options.previewName || productName + " Preview";
    previewAppPath = join(artifactDir, previewName + ".app");
    copyBundle(appPath, previewAppPath);
    fixMacosApp(previewAppPath, { bundleId: options.previewBundleId, displayName: previewName });
  }

  const index = {
    productName,
    version,
    platform,
    generatedAt: new Date().toISOString(),
    sourcePath,
    appPath,
    appFileName: basename(appPath),
    zipPath,
    zipFileName: zipPath ? basename(zipPath) : undefined,
    previewAppPath,
    previewAppFileName: previewAppPath ? basename(previewAppPath) : undefined
  };
  const indexPath = join(artifactDir, "desktop-artifacts.json");
  writeFileSync(indexPath, JSON.stringify(index, null, 2) + "\n");
  console.log("desktop-foundation-ci: wrote " + indexPath);
  if (zipPath) console.log("desktop-foundation-ci: wrote " + zipPath);
  if (previewAppPath) console.log("desktop-foundation-ci: wrote " + previewAppPath);
  return index;
}

function writeManifest(options, packageJson, tauriConfig, packageResult) {
  const productName = inferProductName(options, packageJson, tauriConfig);
  const version = inferVersion(options, packageJson, tauriConfig);
  const artifactDir = resolve(process.cwd(), options.artifactDir);
  const manifestPath = resolve(process.cwd(), options.manifestPath ?? join(options.artifactDir, "latest.json"));
  const artifactName = packageResult?.zipFileName ?? packageResult?.appFileName;
  const downloadUrl = options.downloadUrl ?? makeDownloadUrl(options.downloadBaseUrl, artifactName);
  const manifest = {
    version,
    channel: options.channel,
    notes: options.notes ?? productName + " " + version,
    pubDate: new Date().toISOString(),
    releasePageUrl: options.releaseUrl,
    downloadUrl,
    mandatory: options.mandatory || undefined,
    metadata: {
      productName,
      artifactName,
      platform: packageResult?.platform,
      generatedBy: "desktop-foundation-ci"
    }
  };

  mkdirSync(dirname(manifestPath), { recursive: true });
  if (!existsSync(artifactDir)) mkdirSync(artifactDir, { recursive: true });
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log("desktop-foundation-ci: wrote " + manifestPath);
  return manifest;
}

try {
  const options = parseArgs(process.argv.slice(2));
  const packageJson = readPackageJson();
  const tauriConfig = readTauriConfig();
  const runner = detectRunner(packageJson.packageManager);
  const scripts = [...options.requested, ...options.customScripts];
  for (const script of scripts) runScript(script, packageJson, runner, options.strict);
  const packageResult = options.packageDesktop ? packageDesktopArtifacts(options, packageJson, tauriConfig) : null;
  if (options.manifest) writeManifest(options, packageJson, tauriConfig, packageResult);
  console.log("desktop-foundation-ci: complete");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.error("");
  printHelp();
  process.exit(1);
}
