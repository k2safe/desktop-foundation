#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const knownChecks = ["type-check", "build", "lint", "visual:regression"];

function printHelp() {
  console.log([
    "desktop-foundation-ci",
    "",
    "Usage:",
    "  desktop-foundation-ci [options]",
    "",
    "Options:",
    "  --type-check          Run the package type-check script.",
    "  --build               Run the package build script.",
    "  --lint                Run the package lint script.",
    "  --visual              Run the package visual:regression script.",
    "  --all                 Run type-check, lint, build, and visual:regression.",
    "  --script <name>       Run an additional package script. Can be repeated.",
    "  --no-type-check       Disable the default type-check step.",
    "  --no-build            Disable the default build step.",
    "  --strict              Fail when a requested script is missing.",
    "  --help                Show this help.",
    "",
    "Default:",
    "  desktop-foundation-ci runs type-check and build when those scripts exist."
  ].join("\n"));
}

function parseArgs(argv) {
  const options = {
    requested: new Set(["type-check", "build"]),
    customScripts: [],
    strict: false
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
      const script = argv[index + 1];
      if (!script) throw new Error("Missing value for --script.");
      options.customScripts.push(script);
      index += 1;
      continue;
    }
    throw new Error("Unknown argument: " + arg);
  }

  return options;
}

function readPackageJson() {
  const packagePath = resolve(process.cwd(), "package.json");
  if (!existsSync(packagePath)) {
    throw new Error("Missing package.json in " + process.cwd());
  }
  return JSON.parse(readFileSync(packagePath, "utf8"));
}

function detectRunner(packageManager = "") {
  if (packageManager.startsWith("pnpm@")) return { command: "pnpm", argsFor: (script) => [script] };
  if (packageManager.startsWith("yarn@")) return { command: "yarn", argsFor: (script) => [script] };
  if (packageManager.startsWith("bun@")) return { command: "bun", argsFor: (script) => ["run", script] };
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

try {
  const options = parseArgs(process.argv.slice(2));
  const packageJson = readPackageJson();
  const runner = detectRunner(packageJson.packageManager);
  const scripts = [...options.requested, ...options.customScripts];
  for (const script of scripts) runScript(script, packageJson, runner, options.strict);
  console.log("desktop-foundation-ci: complete");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.error("");
  printHelp();
  process.exit(1);
}
