#!/usr/bin/env node
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const knownChecks = ["type-check", "build", "lint", "visual:regression"];
const defaultArtifactDir = "artifacts/desktop";
const foundationRuntimePackages = [
  "@desktop-foundation/bridge",
  "@desktop-foundation/ui-react",
  "@desktop-foundation/app-shell",
  "@desktop-foundation/theme-presets"
];
const foundationDevPackages = ["@desktop-foundation/create-desktop-app"];
const knownThemeTemplateIds = new Set(["default", "admin", "command", "topnav-ops", "merchant", "ledger", "studio", "dark"]);

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
    "  --strict              Fail when a requested script/package artifact is missing; with --integration-check, also fail on warnings.",
    "  --integration-check   Check whether a product project is wired to the foundation contract.",
    "  --integration-report <path> Write integration check report JSON with findings and capability matrix.",
    "  --integration-summary Print grouped fail/warn next actions and capability matrix. Alias: --summary.",
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
    "  --signing-identity <id>  macOS codesign identity. Defaults to ad-hoc '-'.",
    "  --no-checksum        Skip sha256/size metadata for release artifacts.",
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
    "  --release-plan       Write release-plan.json with local upload assets and gh args.",
    "  --release-plan-path <path> Release plan output path. Defaults to <artifact-dir>/release-plan.json.",
    "  --tag <name>         Release tag for release-plan. Defaults to v<version>.",
    "  --release-name <name> Release name for release-plan.",
    "  --github-repo <owner/repo> Infer GitHub Release URLs and gh commands.",
    "  --github-host <url>  GitHub host. Defaults to https://github.com.",
    "  --manifest-file-name <name> Release manifest asset name. Defaults to latest.json.",
    "  --draft              Add --draft to generated gh release command.",
    "  --prerelease         Add --prerelease to generated gh release command.",
    "  --signature-path <path> Include a detached signature asset in release-plan.",
    "  --notarization-note <text> Add product-owned notarization note to release-plan.",
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
    zip: true,
    checksum: true,
    releasePlan: false,
    integrationCheck: false,
    integrationSummary: false
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
    if (arg === "--integration-check") {
      options.integrationCheck = true;
      options.requested.clear();
      continue;
    }
    if (arg === "--integration-report") {
      options.integrationReportPath = readNext(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--integration-summary" || arg === "--summary") {
      options.integrationSummary = true;
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
    if (arg === "--signing-identity") {
      options.signingIdentity = readNext(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--no-checksum") {
      options.checksum = false;
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
    if (arg === "--release-plan") {
      options.releasePlan = true;
      continue;
    }
    if (arg === "--release-plan-path") {
      options.releasePlanPath = readNext(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--tag") {
      options.tag = readNext(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--release-name") {
      options.releaseName = readNext(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--github-repo") {
      options.githubRepo = readNext(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--github-host") {
      options.githubHost = readNext(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--manifest-file-name") {
      options.manifestFileName = readNext(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--draft") {
      options.draft = true;
      continue;
    }
    if (arg === "--prerelease") {
      options.prerelease = true;
      continue;
    }
    if (arg === "--signature-path") {
      options.signaturePath = readNext(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--notarization-note") {
      options.notarizationNote = readNext(argv, index, arg);
      index += 1;
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
  if (existsSync(resolve(process.cwd(), "pnpm-lock.yaml"))) return { command: "pnpm", argsFor: (script) => [script] };
  if (existsSync(resolve(process.cwd(), "yarn.lock"))) return { command: "yarn", argsFor: (script) => [script] };
  if (existsSync(resolve(process.cwd(), "bun.lockb")) || existsSync(resolve(process.cwd(), "bun.lock"))) return { command: "bun", argsFor: (script) => ["run", script] };
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

function readTextIfExists(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function walkProjectFiles(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    if (["node_modules", "dist", "target", "artifacts", "coverage", "__screenshots__"].includes(entry.name)) continue;
    const filePath = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkProjectFiles(filePath, files);
    } else if (/\.(cjs|mjs|js|jsx|ts|tsx|json|toml|rs|css)$/.test(entry.name)) {
      files.push(filePath);
    }
  }
  return files;
}

function mergeDependencies(packageJson) {
  return {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
    ...packageJson.peerDependencies,
    ...packageJson.optionalDependencies
  };
}

function packageSpec(packageJson, name) {
  const all = mergeDependencies(packageJson);
  return all[name];
}

function tarballVersion(spec) {
  const match = String(spec ?? "").match(/desktop-foundation-[a-z-]+-(\d+\.\d+\.\d+)\.tgz/);
  return match?.[1];
}

function pushFinding(findings, status, id, message, details = {}) {
  findings.push({ status, id, message, ...details });
}

function hasAnyText(files, patterns) {
  for (const file of files) {
    const content = readTextIfExists(file);
    if (patterns.some((pattern) => pattern.test(content))) return true;
  }
  return false;
}

function relativeProjectPath(cwd, file) {
  const root = resolve(cwd);
  const target = resolve(file);
  return target.startsWith(root + "/") ? target.slice(root.length + 1) : target;
}

function hasProjectFile(files, cwd, patterns) {
  return files.some((file) => {
    const relativePath = relativeProjectPath(cwd, file);
    return patterns.some((pattern) => pattern.test(relativePath));
  });
}

function findProjectFiles(files, cwd, patterns, limit = 8) {
  const matches = [];
  for (const file of files) {
    const relativePath = relativeProjectPath(cwd, file);
    if (patterns.some((pattern) => pattern.test(relativePath))) {
      matches.push(relativePath);
      if (matches.length >= limit) break;
    }
  }
  return matches;
}

function matchingSourceFiles(files, cwd, patterns, limit = 8) {
  const matches = [];
  for (const file of files) {
    const content = readTextIfExists(file);
    if (patterns.some((pattern) => pattern.test(content))) {
      matches.push(relativeProjectPath(cwd, file));
      if (matches.length >= limit) break;
    }
  }
  return matches;
}

function collectUnknownThemeTemplateIds(files, cwd, limit = 8) {
  const matches = [];
  const pattern = /\b(?:createThemeTemplateRuntime|getThemeTemplate|getThemeTemplateLayout|getThemeTemplateClassName)\(\s*["']([^"']+)["']/g;
  for (const file of files) {
    const content = readTextIfExists(file);
    for (const match of content.matchAll(pattern)) {
      const templateId = match[1];
      if (!knownThemeTemplateIds.has(templateId)) {
        matches.push(relativeProjectPath(cwd, file) + ":" + templateId);
        if (matches.length >= limit) return matches;
      }
    }
  }
  return matches;
}

function collectFoundationCssOverrides(files, cwd, limit = 8) {
  const matches = [];
  for (const file of files) {
    const content = readTextIfExists(file);
    const selectors = new Set(Array.from(content.matchAll(/\.df-[a-z0-9_-]+/gi)).map((match) => match[0]));
    if (selectors.size) {
      matches.push(relativeProjectPath(cwd, file) + " (" + selectors.size + " df selectors)");
      if (matches.length >= limit) break;
    }
  }
  return matches;
}

function reportNextActions(findings) {
  return findings
    .filter((finding) => finding.status !== "pass")
    .map((finding) => ({
      id: finding.id,
      status: finding.status,
      action: finding.message
    }));
}

function readCapabilityRegistry() {
  const registryPath = join(packageRoot, "foundation-capabilities.json");
  if (!existsSync(registryPath)) return null;
  try {
    return JSON.parse(readFileSync(registryPath, "utf8"));
  } catch (error) {
    return {
      schemaVersion: 0,
      foundationVersion: "unknown",
      capabilities: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function findingStatusForCapability(status) {
  if (status === "pass" || status === "warn" || status === "fail") return status;
  return "missing";
}

function capabilityDisposition(capability, status) {
  if (status === "pass") {
    return {
      disposition: "ready",
      recommendation: "Capability checks are satisfied for the current integration stage."
    };
  }
  if (status === "fail") {
    return {
      disposition: "must-fix",
      recommendation: "Fix failing required checks before migrating business pages or handing the project to another team."
    };
  }

  const phase = capability.phase || "recommended";
  if (phase === "required") {
    return {
      disposition: "fix-or-explain-before-handoff",
      recommendation: "Resolve the warning or document why it is acceptable before handing the integration to another AI or product team."
    };
  }
  if (phase === "required-for-tauri") {
    return {
      disposition: "required-for-tauri",
      recommendation: "Fix before desktop packaging if this product ships through Tauri; otherwise document that the target is web/headless only."
    };
  }
  if (phase === "required-for-networked-products") {
    return {
      disposition: "required-for-networked-products",
      recommendation: "Fix before connecting real APIs or upload/download flows; demo-only projects may document the boundary."
    };
  }
  if (phase === "recommended-before-release") {
    return {
      disposition: "fix-before-release",
      recommendation: "Resolve before publishing a desktop release or explicitly record the product-owned release plan."
    };
  }
  if (phase === "optional") {
    return {
      disposition: "document-if-used",
      recommendation: "No action is required unless the product uses this capability; if it does, document the product-owned policy."
    };
  }
  return {
    disposition: "fix-before-real-business",
    recommendation: "Resolve before real business rollout or document why the product owns a custom implementation."
  };
}

function buildCapabilityMatrix(registry, findings) {
  if (!registry || !Array.isArray(registry.capabilities)) return null;
  const findingById = new Map(findings.map((finding) => [finding.id, finding]));
  const items = registry.capabilities.map((capability) => {
    const requiredIds = capability.integrationChecks?.required ?? [];
    const recommendedIds = capability.integrationChecks?.recommended ?? [];
    const checks = [
      ...requiredIds.map((id) => ({ id, required: true })),
      ...recommendedIds.map((id) => ({ id, required: false }))
    ].map((check) => {
      const finding = findingById.get(check.id);
      return {
        id: check.id,
        required: check.required,
        status: findingStatusForCapability(finding?.status),
        message: finding?.message ?? "Finding was not emitted by this version of desktop-foundation-ci."
      };
    });

    const hasRequiredFail = checks.some((check) => check.required && check.status === "fail");
    const hasRequiredWarn = checks.some((check) => check.required && (check.status === "warn" || check.status === "missing"));
    const hasRecommendedIssue = checks.some((check) => !check.required && check.status !== "pass");
    const status = hasRequiredFail ? "fail" : hasRequiredWarn || hasRecommendedIssue ? "warn" : "pass";
    const disposition = capabilityDisposition(capability, status);

    return {
      id: capability.id,
      name: capability.name,
      status,
      ...disposition,
      phase: capability.phase,
      owner: capability.owner,
      maturity: capability.status,
      summary: capability.summary,
      checks
    };
  });

  return {
    schemaVersion: registry.schemaVersion,
    foundationVersion: registry.foundationVersion,
    generatedFrom: "foundation-capabilities.json",
    summary: {
      status: items.some((item) => item.status === "fail") ? "fail" : items.some((item) => item.status === "warn") ? "warn" : "pass",
      pass: items.filter((item) => item.status === "pass").length,
      warn: items.filter((item) => item.status === "warn").length,
      fail: items.filter((item) => item.status === "fail").length
    },
    items
  };
}

function printIntegrationSummary(report) {
  const actionItems = report.findings.filter((finding) => finding.status !== "pass");
  console.log("");
  console.log("desktop-foundation-ci: next actions");
  console.log(`  status: ${report.summary.status} (${report.summary.pass} pass, ${report.summary.warn} warn, ${report.summary.fail} fail)`);
  console.log(`  scanned: ${report.stats.filesScanned} files, ${report.stats.sourceFilesScanned} source files`);

  if (!actionItems.length) {
    console.log("  no action required.");
  } else {
    for (const finding of actionItems) {
      console.log(`  - [${finding.status.toUpperCase()}] ${finding.id}: ${finding.message}`);
      if (Array.isArray(finding.files) && finding.files.length) {
        console.log(`    files: ${finding.files.join(", ")}`);
      }
    }
  }

  if (report.capabilities) {
    const capabilityItems = report.capabilities.items.filter((item) => item.status !== "pass");
    console.log("");
    console.log("desktop-foundation-ci: capability matrix");
    console.log(
      `  status: ${report.capabilities.summary.status} (${report.capabilities.summary.pass} pass, ${report.capabilities.summary.warn} warn, ${report.capabilities.summary.fail} fail)`
    );
    if (!capabilityItems.length) {
      console.log("  all capabilities are satisfied for this integration stage.");
      return;
    }
    for (const item of capabilityItems) {
      console.log(`  - [${item.status.toUpperCase()}] ${item.id}: ${item.name} (${item.disposition})`);
      console.log(`    recommendation: ${item.recommendation}`);
      const checks = item.checks.filter((check) => check.status !== "pass");
      if (checks.length) {
        console.log(`    checks: ${checks.map((check) => `${check.id}=${check.status}`).join(", ")}`);
      }
    }
  }
}

function runIntegrationCheck(options, packageJson) {
  const cwd = process.cwd();
  const findings = [];
  const files = walkProjectFiles(cwd);
  const sourceFiles = files.filter((file) => /\.(cjs|mjs|js|jsx|ts|tsx)$/.test(file));
  const cssFiles = files.filter((file) => /\.css$/.test(file));
  const packageManager = packageJson.packageManager || process.env.npm_config_user_agent || "";

  pushFinding(findings, "pass", "package-json", "package.json is present.");
  if (/pnpm@/.test(packageManager) || existsSync(resolve(cwd, "pnpm-lock.yaml"))) {
    pushFinding(findings, "pass", "package-manager", "pnpm package manager context detected.");
  } else {
    pushFinding(findings, "warn", "package-manager", "pnpm was not detected; raw tarball overrides are tested primarily with pnpm.");
  }

  const specs = new Map();
  for (const name of foundationRuntimePackages) {
    const spec = packageSpec(packageJson, name);
    if (spec) {
      specs.set(name, spec);
      pushFinding(findings, "pass", "dependency:" + name, name + " is installed.", { spec });
    } else {
      pushFinding(findings, "fail", "dependency:" + name, name + " is missing from dependencies.");
    }
  }

  for (const name of foundationDevPackages) {
    const spec = packageSpec(packageJson, name);
    if (spec) {
      specs.set(name, spec);
      pushFinding(findings, "pass", "dependency:" + name, name + " is installed.", { spec });
    } else {
      pushFinding(findings, "warn", "dependency:" + name, name + " is not installed; CI wrapper and scaffolding commands may be unavailable.");
    }
  }

  const tarballVersions = [...specs.values()].map(tarballVersion).filter(Boolean);
  if (tarballVersions.length) {
    const uniqueVersions = Array.from(new Set(tarballVersions));
    if (uniqueVersions.length === 1) {
      pushFinding(findings, "pass", "foundation-version", "Foundation tarball versions are aligned.", { version: uniqueVersions[0] });
    } else {
      pushFinding(findings, "fail", "foundation-version", "Foundation tarball versions are mixed.", { versions: uniqueVersions });
    }
  }

  const overrides = packageJson.pnpm?.overrides ?? {};
  for (const name of [...foundationRuntimePackages, ...foundationDevPackages]) {
    const spec = packageSpec(packageJson, name);
    if (String(spec ?? "").includes("raw.githubusercontent.com") && overrides[name] !== spec) {
      pushFinding(findings, "warn", "pnpm-overrides:" + name, name + " should be pinned in pnpm.overrides to avoid transitive drift.", {
        expected: spec,
        actual: overrides[name]
      });
    }
  }

  if (hasAnyText(sourceFiles, [/@desktop-foundation\/ui-react\/styles\.css/])) {
    pushFinding(findings, "pass", "ui-styles", "Shared foundation stylesheet is imported.");
  } else {
    pushFinding(findings, "fail", "ui-styles", "Missing import for @desktop-foundation/ui-react/styles.css.");
  }

  if (hasAnyText(sourceFiles, [/DesktopAppShell/, /from\s+["']@desktop-foundation\/app-shell["']/])) {
    pushFinding(findings, "pass", "app-shell", "DesktopAppShell/app-shell usage detected.");
  } else {
    pushFinding(findings, "fail", "app-shell", "DesktopAppShell from @desktop-foundation/app-shell was not detected.");
  }

  if (hasAnyText(sourceFiles, [/createThemeTemplateRuntime/, /themeTemplates/, /getThemeTemplateLayout/])) {
    pushFinding(findings, "pass", "theme-template", "Theme template runtime usage detected.");
  } else {
    pushFinding(findings, "fail", "theme-template", "Theme template runtime usage was not detected.");
  }

  const unknownThemeTemplates = collectUnknownThemeTemplateIds(sourceFiles, cwd);
  if (unknownThemeTemplates.length) {
    pushFinding(findings, "warn", "theme-template:id", "Unknown theme template id detected; use a built-in template or pass a full custom template object intentionally.", {
      files: unknownThemeTemplates
    });
  } else {
    pushFinding(findings, "pass", "theme-template:id", "No unknown literal theme template ids were detected.");
  }

  if (hasAnyText(sourceFiles, [/DesktopLoginPage/])) {
    pushFinding(findings, "pass", "login-shell", "DesktopLoginPage usage detected.");
    const loginTemplateFiles = matchingSourceFiles(sourceFiles, cwd, [/<DesktopLoginPage[\s\S]*\btemplate\s*=/]);
    if (loginTemplateFiles.length) {
      pushFinding(findings, "pass", "login-template", "DesktopLoginPage template usage detected.", { files: loginTemplateFiles });
    } else {
      pushFinding(findings, "warn", "login-template", "DesktopLoginPage is used without the template prop; prefer template ids or template.layout.login for reusable login layouts.");
    }
  } else {
    pushFinding(findings, "warn", "login-shell", "DesktopLoginPage was not detected; product may own a custom login flow.");
  }

  if (hasProjectFile(files, cwd, [/^src\/product-adapter\.(ts|tsx)$/])) {
    pushFinding(findings, "pass", "product-adapter:file", "Product adapter entry exists at src/product-adapter.");
  } else {
    pushFinding(findings, "warn", "product-adapter:file", "src/product-adapter.tsx was not found; keep brand, menus, theme, user menu, client defaults, and update config in a thin product adapter.");
  }

  const productAdapterReferences = matchingSourceFiles(sourceFiles, cwd, [
    /\bproductAdapter\b/,
    /from\s+["'][^"']*product-adapter["']/,
    /import\s*\([^)]*["'][^"']*product-adapter["'][^)]*\)/
  ]);
  if (productAdapterReferences.length) {
    pushFinding(findings, "pass", "product-adapter:usage", "Product adapter usage detected.", { files: productAdapterReferences });
  } else {
    pushFinding(findings, "warn", "product-adapter:usage", "No productAdapter usage was detected; avoid scattering foundation configuration across business pages.");
  }

  const accessControlFiles = matchingSourceFiles(sourceFiles, cwd, [
    /\baccessControl\s*[:=]/,
    /\bAccessGuard\b/,
    /\bPermissionGuard\b/,
    /\bFeatureGuard\b/,
    /\bpermission\s*:/,
    /\bpermissions\s*:/,
    /\bfeature\s*:/,
    /\bfeatures\s*:/
  ]);
  if (accessControlFiles.length) {
    pushFinding(findings, "pass", "access-control", "Access control surface detected.", { files: accessControlFiles });
  } else {
    pushFinding(findings, "warn", "access-control", "No access control surface detected; define permissions/features in product-adapter, menus, commands, or page guards before real business rollout.");
  }

  const auditEventFiles = matchingSourceFiles(sourceFiles, cwd, [
    /\bonAuditEvent\s*:/,
    /\bauditObserver\s*:/,
    /\brecordAuditEvent\s*\(/,
    /\bgetRecentAuditEvents\s*\(/
  ]);
  if (auditEventFiles.length) {
    pushFinding(findings, "pass", "audit-events", "Audit event surface detected.", { files: auditEventFiles });
  } else {
    pushFinding(findings, "warn", "audit-events", "No audit event sink was detected; wire onAuditEvent or auditObserver before real business rollout.");
  }

  const i18nSurfaceFiles = matchingSourceFiles(sourceFiles, cwd, [
    /\blocale\s*=/,
    /\blocale\s*:/,
    /\bmessages\s*=/,
    /\bmessages\s*:/,
    /\bdictionaries\s*=/,
    /\bdictionaries\s*:/
  ]);
  if (i18nSurfaceFiles.length) {
    pushFinding(findings, "pass", "i18n", "Locale surface detected.", { files: i18nSurfaceFiles });
  } else {
    pushFinding(findings, "warn", "i18n", "No locale surface was detected; set locale/messages/dictionaries in the product adapter before multilingual rollout.");
  }

  const i18nDiagnosticsFiles = matchingSourceFiles(sourceFiles, cwd, [
    /\bonMissingLocaleKey\s*=/,
    /\bonMissingLocaleKey\s*:/,
    /\bonMissingKey\s*=/,
    /\bonMissingKey\s*:/,
    /\bmissingKeyObserver\s*=/,
    /\bmissingKeyObserver\s*:/,
    /\bgetMissingLocaleKeys\s*\(/
  ]);
  if (i18nDiagnosticsFiles.length) {
    pushFinding(findings, "pass", "i18n:missing-key", "Missing locale key diagnostics detected.", { files: i18nDiagnosticsFiles });
  } else {
    pushFinding(findings, "warn", "i18n:missing-key", "No missing-key diagnostics were detected; wire onMissingLocaleKey/onMissingKey or run getMissingLocaleKeys before multilingual rollout.");
  }

  const i18nFormatterFiles = matchingSourceFiles(sourceFiles, cwd, [
    /\bformatDefaults\s*=/,
    /\bformatDefaults\s*:/,
    /\bformat\.(number|currency|date|time|dateTime)\s*\(/,
    /\bcreateLocaleFormatters\s*\(/
  ]);
  if (i18nFormatterFiles.length) {
    pushFinding(findings, "pass", "i18n:formatters", "Locale formatter policy detected.", { files: i18nFormatterFiles });
  } else {
    pushFinding(findings, "warn", "i18n:formatters", "No locale formatter policy was detected; use formatDefaults or useLocale().format for number/date/currency formatting.");
  }

  const copiedFoundationSources = findProjectFiles(files, cwd, [
    /^packages\/desktop-ui-react\/src\//,
    /^packages\/desktop-bridge\/src\//,
    /^packages\/desktop-app-shell\/src\//,
    /^packages\/theme-presets\/src\//,
    /^crates\/desktop-core-rs\/src\//,
    /^desktop-core-rs\/src\//,
    /^src\/@desktop-foundation\//,
    /^src\/desktop-foundation\//
  ]);
  if (copiedFoundationSources.length) {
    pushFinding(findings, "warn", "foundation-source-copy", "Foundation package source appears inside the product project; consume packages and adapt through product-adapter instead of copying internals.", {
      files: copiedFoundationSources
    });
  } else {
    pushFinding(findings, "pass", "foundation-source-copy", "No copied foundation source tree was detected.");
  }

  const internalFoundationImports = matchingSourceFiles(sourceFiles, cwd, [
    /from\s+["'][^"']*@desktop-foundation\/[^"']*\/src\//,
    /import\s*\([^)]*["'][^"']*@desktop-foundation\/[^"']*\/src\//,
    /from\s+["'][^"']*(packages|crates)\/(desktop-ui-react|desktop-bridge|desktop-app-shell|theme-presets|desktop-core-rs)\/src\//
  ]);
  if (internalFoundationImports.length) {
    pushFinding(findings, "warn", "foundation-internal-import", "Imports point at foundation internals; import public package exports only.", { files: internalFoundationImports });
  } else {
    pushFinding(findings, "pass", "foundation-internal-import", "No direct foundation internal imports were detected.");
  }

  const foundationCssOverrides = collectFoundationCssOverrides(cssFiles, cwd);
  if (foundationCssOverrides.length) {
    pushFinding(findings, "warn", "foundation-css-overrides", "Product CSS overrides df-* foundation selectors; prefer theme tokens, templates, or product-owned wrapper classes.", {
      files: foundationCssOverrides
    });
  } else {
    pushFinding(findings, "pass", "foundation-css-overrides", "No product CSS overriding df-* selectors was detected.");
  }

  const tableUsageFiles = matchingSourceFiles(sourceFiles, cwd, [
    /\bDataTable\b/,
    /\bEditableTable\b/,
    /<Table\b/,
    /<table\b/,
    /\bdf-table\b/
  ]);
  if (tableUsageFiles.length) {
    const tableGuardFiles = matchingSourceFiles(sourceFiles, cwd, [
      /\bDataTable\b/,
      /\bEditableTable\b/,
      /\bdf-table-wrap\b/,
      /overflowX\s*:/,
      /overflow-x/,
      /minWidth\s*:/,
      /\btableContainer\b/
    ]);
    const rawTableFiles = matchingSourceFiles(sourceFiles, cwd, [/<table\b/, /\bdf-table\b/]);
    if (tableGuardFiles.length) {
      pushFinding(findings, "pass", "overflow:table", "Table usage has a likely local overflow guard.", {
        files: tableGuardFiles,
        tableFiles: tableUsageFiles
      });
    } else {
      pushFinding(findings, "warn", "overflow:table", "Table usage was detected without an obvious local overflow guard; use DataTable/Table/EditableTable or wrap wide tables in a horizontal scroll container.", {
        files: rawTableFiles.length ? rawTableFiles : tableUsageFiles
      });
    }
  } else {
    pushFinding(findings, "warn", "overflow:table", "No table usage was detected; skip table overflow verification until the product adds list pages.");
  }

  const overlayUsageFiles = matchingSourceFiles(sourceFiles, cwd, [
    /\bModal\b/,
    /\bDrawer\b/,
    /\bDetailDrawer\b/,
    /\bdf-modal\b/,
    /\bdf-drawer\b/
  ]);
  if (overlayUsageFiles.length) {
    const overlayGuardFiles = matchingSourceFiles(sourceFiles, cwd, [
      /\bDataTable\b/,
      /\bEditableTable\b/,
      /\bdf-table-wrap\b/,
      /maxHeight\s*:/,
      /overflow(Y|X)?\s*:/,
      /overflow-y/,
      /overflow-x/,
      /\bdf-modal__body\b/,
      /\bdf-drawer__body\b/
    ]);
    if (overlayGuardFiles.length) {
      pushFinding(findings, "pass", "overflow:overlay", "Modal/drawer usage has a likely internal scroll or table overflow guard.", {
        files: overlayGuardFiles,
        overlayFiles: overlayUsageFiles
      });
    } else {
      pushFinding(findings, "warn", "overflow:overlay", "Modal/drawer usage was detected; verify long content and wide tables scroll inside the overlay instead of stretching the page.", {
        files: overlayUsageFiles
      });
    }
  } else {
    pushFinding(findings, "pass", "overflow:overlay", "No modal or drawer usage was detected.");
  }

  const tauriDir = resolve(cwd, "src-tauri");
  const cargoTomlPath = join(tauriDir, "Cargo.toml");
  const capabilitiesPath = join(tauriDir, "capabilities", "default.json");
  if (existsSync(tauriDir)) {
    const cargoToml = readTextIfExists(cargoTomlPath);
    if (/desktop-core-rs\s*=/.test(cargoToml)) {
      pushFinding(findings, "pass", "tauri-core", "desktop-core-rs dependency detected.");
    } else {
      pushFinding(findings, "fail", "tauri-core", "src-tauri exists but desktop-core-rs is missing from Cargo.toml.");
    }

    const capabilities = readTextIfExists(capabilitiesPath);
    if (/desktop-core:default/.test(capabilities)) {
      pushFinding(findings, "pass", "tauri-capability", "desktop-core:default capability detected.");
    } else {
      pushFinding(findings, "warn", "tauri-capability", "desktop-core:default capability was not detected in src-tauri/capabilities/default.json.");
    }
  } else {
    pushFinding(findings, "warn", "tauri-core", "src-tauri directory was not found; desktop packaging checks are skipped.");
  }

  if (hasAnyText(sourceFiles, [/updateConfig\s*:/, /VITE_UPDATE_MANIFEST_URL/, /VITE_UPDATE_GITHUB_REPO/, /createGitHubReleasesUpdateConfig/, /createGitHubReleasesUpdateCapability/])) {
    pushFinding(findings, "pass", "updates", "Client update configuration surface detected.");
  } else {
    pushFinding(findings, "warn", "updates", "No updateConfig or GitHub Releases updater usage detected.");
  }

  const placeholderUpdateFiles = matchingSourceFiles(sourceFiles, cwd, [/owner\/(repo|repository)/, /example\.com\/owner\/repo/]);
  if (placeholderUpdateFiles.length) {
    pushFinding(findings, "warn", "updates:placeholder", "Placeholder update repository or URL detected; replace it with product-owned VITE_UPDATE_* configuration before release.", { files: placeholderUpdateFiles });
  } else {
    pushFinding(findings, "pass", "updates:placeholder", "No placeholder update repository or URL was detected.");
  }

  const updateInstallAdapterFiles = matchingSourceFiles(sourceFiles, cwd, [
    /installUpdate\s*:/,
    /nativePlugins\s*:/,
    /@tauri-apps\/plugin-updater/,
    /\bdownloadAndInstall\s*\(/
  ]);
  if (updateInstallAdapterFiles.length) {
    pushFinding(findings, "pass", "updates:install-boundary", "Update installer adapter wiring detected; keep install/restart behavior at the client or native adapter boundary.", {
      files: updateInstallAdapterFiles
    });
  } else {
    pushFinding(findings, "pass", "updates:install-boundary", "No installer adapter wiring was detected; product UI should stay at discover, download, and checksum status until the adapter is ready.");
  }

  const updateInstallBypassFiles = matchingSourceFiles(sourceFiles, cwd, [
    /\b(?:relaunch|restart)\s*\(/,
    /@tauri-apps\/(?:api|plugin)-(?:process|shell)/,
    /\bCommand\.create\s*\([\s\S]*?(?:open|cp|mv|ditto|osascript)/,
    /\b(?:copyFile|rename|removeFile|removeDir|writeFile|writeTextFile)\s*\([\s\S]*?(?:\.app|\/Applications)/,
    /\/Applications\/[\s\S]*?\.app/,
    /\.app[\s\S]*?(?:replace|relaunch|restart|Applications)/
  ]);
  if (updateInstallBypassFiles.length) {
    pushFinding(findings, "warn", "updates:install-bypass", "Potential direct app replacement or relaunch logic was detected; route real install/restart behavior through the foundation/Tauri updater adapter instead of business pages.", {
      files: updateInstallBypassFiles
    });
  } else {
    pushFinding(findings, "pass", "updates:install-bypass", "No direct app replacement or relaunch bypass was detected.");
  }

  const linkProxySurfaceFiles = matchingSourceFiles(sourceFiles, cwd, [
    /\bclient\.linkProxy\b/,
    /\blinkProxy\s*:/,
    /VITE_LINK_PROXY_URL/,
    /allowedLinkProxyOrigins/,
    /allowedLinkTargetOrigins/
  ]);
  if (linkProxySurfaceFiles.length) {
    pushFinding(findings, "pass", "link-proxy", "Link proxy configuration or usage detected.", { files: linkProxySurfaceFiles });
  } else {
    pushFinding(findings, "pass", "link-proxy", "No arbitrary link proxy usage was detected.");
  }

  const linkProxyGatewayFiles = matchingSourceFiles(sourceFiles, cwd, [/VITE_LINK_PROXY_URL/, /proxyBaseURL\s*:/, /mode\s*:\s*["']gateway["']/]);
  const linkProxyGatewayPolicyFiles = matchingSourceFiles(sourceFiles, cwd, [/allowedLinkProxyOrigins/, /VITE_LINK_PROXY_ORIGINS/]);
  if (linkProxyGatewayFiles.length && !linkProxyGatewayPolicyFiles.length) {
    pushFinding(findings, "warn", "link-proxy:gateway-policy", "Link proxy gateway is configured without allowedLinkProxyOrigins or VITE_LINK_PROXY_ORIGINS; local, VPN, and intranet proxy hosts should be explicitly allowed.", {
      files: linkProxyGatewayFiles
    });
  } else {
    pushFinding(findings, "pass", "link-proxy:gateway-policy", linkProxyGatewayFiles.length ? "Link proxy gateway origin policy detected." : "No link proxy gateway config was detected.", {
      files: linkProxyGatewayPolicyFiles.length ? linkProxyGatewayPolicyFiles : undefined
    });
  }

  const linkProxyDirectFiles = matchingSourceFiles(sourceFiles, cwd, [/mode\s*:\s*["']direct["']/]);
  const linkProxyTargetPolicyFiles = matchingSourceFiles(sourceFiles, cwd, [/allowedLinkTargetOrigins/, /VITE_LINK_TARGET_ORIGINS/]);
  if (linkProxyDirectFiles.length && !linkProxyTargetPolicyFiles.length) {
    pushFinding(findings, "warn", "link-proxy:direct-policy", "Direct link proxy mode requires allowedLinkTargetOrigins or VITE_LINK_TARGET_ORIGINS so the bridge does not become an unbounded request surface.", {
      files: linkProxyDirectFiles
    });
  } else {
    pushFinding(findings, "pass", "link-proxy:direct-policy", linkProxyDirectFiles.length ? "Direct link proxy target policy detected." : "No direct link proxy mode was detected.", {
      files: linkProxyTargetPolicyFiles.length ? linkProxyTargetPolicyFiles : undefined
    });
  }

  const linkProxyBypassFiles = matchingSourceFiles(sourceFiles, cwd, [
    /\bfetch\s*\(\s*["']https?:\/\//,
    /\baxios\.\w+\s*\(\s*["']https?:\/\//,
    /\baxios\s*\(\s*\{[\s\S]*?\burl\s*:\s*["']https?:\/\//,
    /\bnew\s+EventSource\s*\(\s*["']https?:\/\//,
    /\bnew\s+WebSocket\s*\(\s*["']wss?:\/\//
  ]);
  if (linkProxyBypassFiles.length) {
    pushFinding(findings, "warn", "link-proxy:bypass", "External absolute URL requests were detected outside client.linkProxy; route arbitrary third-party links through the foundation link proxy unless this is a deliberate product-owned API boundary.", {
      files: linkProxyBypassFiles
    });
  } else {
    pushFinding(findings, "pass", "link-proxy:bypass", "No obvious external absolute URL request bypass was detected.");
  }

  for (const script of ["type-check", "build"]) {
    if (packageJson.scripts?.[script]) {
      pushFinding(findings, "pass", "script:" + script, "package script \"" + script + "\" is present.");
    } else {
      pushFinding(findings, "fail", "script:" + script, "package script \"" + script + "\" is missing.");
    }
  }
  for (const script of ["visual:regression", "package:desktop"]) {
    if (packageJson.scripts?.[script]) {
      pushFinding(findings, "pass", "script:" + script, "package script \"" + script + "\" is present.");
    } else {
      pushFinding(findings, "warn", "script:" + script, "package script \"" + script + "\" is not present.");
    }
  }
  if (packageJson.scripts?.["release:manifest"] || packageJson.scripts?.["release:desktop"]) {
    pushFinding(findings, "pass", "script:release", "Desktop release manifest script is present.");
  } else {
    pushFinding(findings, "warn", "script:release", "No release manifest script detected; add a script that runs desktop-foundation-ci --manifest --release-plan when releases are wired.");
  }

  const summary = {
    status: findings.some((finding) => finding.status === "fail") ? "fail" : findings.some((finding) => finding.status === "warn") ? "warn" : "pass",
    pass: findings.filter((finding) => finding.status === "pass").length,
    warn: findings.filter((finding) => finding.status === "warn").length,
    fail: findings.filter((finding) => finding.status === "fail").length
  };
  const capabilities = buildCapabilityMatrix(readCapabilityRegistry(), findings);
  const report = {
    generatedAt: new Date().toISOString(),
    cwd,
    packageName: packageJson.name,
    stats: {
      filesScanned: files.length,
      sourceFilesScanned: sourceFiles.length
    },
    summary,
    nextActions: reportNextActions(findings),
    findings
  };
  if (capabilities) report.capabilities = capabilities;

  for (const finding of findings) {
    const label = finding.status.toUpperCase().padEnd(4);
    console.log(`desktop-foundation-ci: ${label} ${finding.id} - ${finding.message}`);
  }
  console.log(`desktop-foundation-ci: integration ${summary.status} (${summary.pass} pass, ${summary.warn} warn, ${summary.fail} fail)`);
  if (capabilities) {
    console.log(
      `desktop-foundation-ci: capabilities ${capabilities.summary.status} (${capabilities.summary.pass} pass, ${capabilities.summary.warn} warn, ${capabilities.summary.fail} fail)`
    );
  }
  if (options.integrationSummary) {
    printIntegrationSummary(report);
  }

  if (options.integrationReportPath) {
    const reportPath = resolve(cwd, options.integrationReportPath);
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
    console.log("desktop-foundation-ci: wrote " + reportPath);
  }

  if (summary.fail > 0) {
    throw new Error("desktop-foundation-ci: integration check failed.");
  }
  if (options.strict && summary.warn > 0) {
    throw new Error("desktop-foundation-ci: integration check has warnings under --strict.");
  }
  return report;
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
  const signingIdentity = overrides.signingIdentity ?? "-";
  runCommand("codesign", ["--force", "--deep", "--sign", signingIdentity, appPath]);
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

function normalizeGithubHost(value) {
  const host = value || "https://github.com";
  return (/^https?:\/\//.test(host) ? host : "https://" + host).replace(/\/$/, "");
}

function parseGithubRepo(value) {
  if (!value) return null;
  const trimmed = String(value).trim().replace(/\.git$/, "");
  const urlMatch = trimmed.match(/^https?:\/\/[^/]+\/([^/]+\/[^/]+)$/);
  const repo = (urlMatch ? urlMatch[1] : trimmed).replace(/^\/+|\/+$/g, "");
  if (!/^[^/]+\/[^/]+$/.test(repo)) {
    throw new Error("--github-repo must look like owner/repo.");
  }
  return repo;
}

function githubReleaseBaseUrl(options, tagName) {
  const repo = parseGithubRepo(options.githubRepo);
  if (!repo) return undefined;
  return `${normalizeGithubHost(options.githubHost)}/${repo}/releases/download/${encodeURIComponent(tagName)}`;
}

function githubReleasePageUrl(options, tagName) {
  const repo = parseGithubRepo(options.githubRepo);
  if (!repo) return undefined;
  return `${normalizeGithubHost(options.githubHost)}/${repo}/releases/tag/${encodeURIComponent(tagName)}`;
}

function githubLatestManifestUrl(options, manifestPath) {
  const repo = parseGithubRepo(options.githubRepo);
  if (!repo) return undefined;
  const manifestFileName = options.manifestFileName ?? (manifestPath ? basename(manifestPath) : "latest.json");
  return `${normalizeGithubHost(options.githubHost)}/${repo}/releases/latest/download/${encodeURIComponent(manifestFileName)}`;
}

function githubCliRepoArg(options) {
  const repo = parseGithubRepo(options.githubRepo);
  if (!repo) return undefined;
  const host = new URL(normalizeGithubHost(options.githubHost)).hostname;
  return host === "github.com" ? repo : `${host}/${repo}`;
}

function fileSha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function releaseFileMetadata(filePath) {
  if (!filePath || !existsSync(filePath) || isDirectory(filePath)) return null;
  const fileName = basename(filePath);
  return {
    path: filePath,
    fileName,
    size: statSync(filePath).size,
    sha256: fileSha256(filePath),
    checksumPath: filePath + ".sha256",
    checksumFileName: fileName + ".sha256"
  };
}

function writeChecksumFile(metadata) {
  if (!metadata) return;
  writeFileSync(metadata.checksumPath, metadata.sha256 + "  " + metadata.fileName + "\n");
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
  fixMacosApp(appPath, { signingIdentity: options.signingIdentity });

  let zipPath = null;
  if (options.zip && isDirectory(appPath)) {
    zipPath = createZipForBundle(appPath, artifactDir, baseName + ".zip");
  }

  let previewAppPath = null;
  if (options.previewBundleId && process.platform === "darwin" && appPath.endsWith(".app")) {
    const previewName = options.previewName || productName + " Preview";
    previewAppPath = join(artifactDir, previewName + ".app");
    copyBundle(appPath, previewAppPath);
    fixMacosApp(previewAppPath, { bundleId: options.previewBundleId, displayName: previewName, signingIdentity: options.signingIdentity });
  }

  const releasePath = zipPath ?? (!isDirectory(appPath) ? appPath : null);
  const releaseMetadata = options.checksum ? releaseFileMetadata(releasePath) : null;
  if (releaseMetadata) writeChecksumFile(releaseMetadata);

  const indexPath = join(artifactDir, "desktop-artifacts.json");
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
    releasePath,
    releaseFileName: releaseMetadata?.fileName ?? (releasePath ? basename(releasePath) : undefined),
    releaseSize: releaseMetadata?.size,
    releaseSha256: releaseMetadata?.sha256,
    checksumPath: releaseMetadata?.checksumPath,
    checksumFileName: releaseMetadata?.checksumFileName,
    previewAppPath,
    previewAppFileName: previewAppPath ? basename(previewAppPath) : undefined,
    indexPath,
    signing: {
      macosIdentity: process.platform === "darwin" ? options.signingIdentity ?? "-" : undefined,
      notarization: "not-configured"
    }
  };
  writeFileSync(indexPath, JSON.stringify(index, null, 2) + "\n");
  console.log("desktop-foundation-ci: wrote " + indexPath);
  if (zipPath) console.log("desktop-foundation-ci: wrote " + zipPath);
  if (releaseMetadata) console.log("desktop-foundation-ci: wrote " + releaseMetadata.checksumPath);
  if (previewAppPath) console.log("desktop-foundation-ci: wrote " + previewAppPath);
  return index;
}

function writeManifest(options, packageJson, tauriConfig, packageResult) {
  const productName = inferProductName(options, packageJson, tauriConfig);
  const version = inferVersion(options, packageJson, tauriConfig);
  const tagName = options.tag ?? "v" + version;
  const artifactDir = resolve(process.cwd(), options.artifactDir);
  const manifestPath = resolve(process.cwd(), options.manifestPath ?? join(options.artifactDir, "latest.json"));
  const artifactName = packageResult?.releaseFileName ?? packageResult?.zipFileName ?? packageResult?.appFileName;
  const downloadBaseUrl = options.downloadBaseUrl ?? githubReleaseBaseUrl(options, tagName);
  const releasePageUrl = options.releaseUrl ?? githubReleasePageUrl(options, tagName);
  const downloadUrl = options.downloadUrl ?? makeDownloadUrl(downloadBaseUrl, artifactName);
  const manifest = {
    version,
    channel: options.channel,
    notes: options.notes ?? productName + " " + version,
    pubDate: new Date().toISOString(),
    releasePageUrl,
    downloadUrl,
    sha256: packageResult?.releaseSha256,
    size: packageResult?.releaseSize,
    mandatory: options.mandatory || undefined,
    metadata: {
      productName,
      artifactName,
      platform: packageResult?.platform,
      sizeBytes: packageResult?.releaseSize,
      sha256: packageResult?.releaseSha256,
      checksumFileName: packageResult?.checksumFileName,
      signing: packageResult?.signing,
      tagName,
      githubRepo: parseGithubRepo(options.githubRepo) ?? undefined,
      generatedBy: "desktop-foundation-ci"
    }
  };

  mkdirSync(dirname(manifestPath), { recursive: true });
  if (!existsSync(artifactDir)) mkdirSync(artifactDir, { recursive: true });
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log("desktop-foundation-ci: wrote " + manifestPath);
  return { manifest, manifestPath };
}

function releaseAsset(path, kind) {
  if (!path || !existsSync(path)) return null;
  return { path, fileName: basename(path), kind, bytes: isDirectory(path) ? undefined : statSync(path).size };
}

function writeReleasePlan(options, packageJson, tauriConfig, packageResult, manifestResult) {
  const productName = inferProductName(options, packageJson, tauriConfig);
  const version = inferVersion(options, packageJson, tauriConfig);
  const tagName = options.tag ?? "v" + version;
  const releaseName = options.releaseName ?? productName + " " + version;
  const releasePageUrl = options.releaseUrl ?? githubReleasePageUrl(options, tagName);
  const latestManifestUrl = githubLatestManifestUrl(options, manifestResult?.manifestPath);
  const planPath = resolve(process.cwd(), options.releasePlanPath ?? join(options.artifactDir, "release-plan.json"));
  const assets = [
    releaseAsset(packageResult?.releasePath, "desktop-update-archive"),
    releaseAsset(packageResult?.checksumPath, "checksum"),
    releaseAsset(manifestResult?.manifestPath, "update-manifest"),
    releaseAsset(packageResult?.indexPath, "artifact-index"),
    releaseAsset(options.signaturePath ? resolve(process.cwd(), options.signaturePath) : undefined, "signature")
  ].filter(Boolean);
  const assetPaths = assets.map((asset) => asset.path);
  const ghRepoArg = githubCliRepoArg(options);
  const ghReleaseCreate = [
    "gh",
    "release",
    "create",
    tagName,
    ...assetPaths,
    "--title",
    releaseName,
    "--notes",
    options.notes ?? releaseName
  ];
  if (ghRepoArg) ghReleaseCreate.push("--repo", ghRepoArg);
  if (options.draft) ghReleaseCreate.push("--draft");
  if (options.prerelease) ghReleaseCreate.push("--prerelease");
  const ghReleaseUpload = ["gh", "release", "upload", tagName, ...assetPaths, "--clobber"];
  if (ghRepoArg) ghReleaseUpload.push("--repo", ghRepoArg);
  const plan = {
    productName,
    version,
    channel: options.channel,
    tagName,
    releaseName,
    releasePageUrl,
    latestManifestUrl,
    downloadUrl: manifestResult?.manifest.downloadUrl,
    manifestPath: manifestResult?.manifestPath,
    manifest: manifestResult?.manifest,
    assets,
    checksums: assets
      .filter((asset) => asset.kind === "desktop-update-archive" || asset.kind === "checksum")
      .map((asset) => ({ fileName: asset.fileName, path: asset.path, bytes: asset.bytes })),
    github: parseGithubRepo(options.githubRepo)
      ? {
          host: normalizeGithubHost(options.githubHost),
          repo: parseGithubRepo(options.githubRepo),
          releasePageUrl,
          latestManifestUrl,
          draft: Boolean(options.draft),
          prerelease: Boolean(options.prerelease)
        }
      : undefined,
    ghReleaseCreate,
    ghReleaseUpload,
    signing: packageResult?.signing ?? { notarization: "not-configured" },
    notarization: {
      status: "not-configured",
      env: ["APPLE_ID", "APPLE_TEAM_ID", "APPLE_APP_SPECIFIC_PASSWORD"],
      note: options.notarizationNote ?? "Product projects can add notarization before release upload without changing client update code."
    },
    generatedAt: new Date().toISOString(),
    generatedBy: "desktop-foundation-ci"
  };
  mkdirSync(dirname(planPath), { recursive: true });
  writeFileSync(planPath, JSON.stringify(plan, null, 2) + "\n");
  console.log("desktop-foundation-ci: wrote " + planPath);
  return plan;
}

try {
  const options = parseArgs(process.argv.slice(2));
  const packageJson = readPackageJson();
  const tauriConfig = readTauriConfig();
  const runner = detectRunner(packageJson.packageManager);
  if (options.integrationCheck) runIntegrationCheck(options, packageJson);
  const scripts = [...options.requested, ...options.customScripts];
  for (const script of scripts) runScript(script, packageJson, runner, options.strict);
  const packageResult = options.packageDesktop ? packageDesktopArtifacts(options, packageJson, tauriConfig) : null;
  const manifestResult = options.manifest ? writeManifest(options, packageJson, tauriConfig, packageResult) : null;
  if (options.releasePlan) writeReleasePlan(options, packageJson, tauriConfig, packageResult, manifestResult);
  console.log("desktop-foundation-ci: complete");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith("Unknown argument:") || message.startsWith("Missing value for ")) {
    console.error("");
    printHelp();
  }
  process.exit(1);
}
