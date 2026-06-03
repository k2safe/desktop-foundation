#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const binDir = dirname(fileURLToPath(import.meta.url));
const invokedAs = basename(process.argv[1] || "");

function printHelp() {
  console.log([
    "desktop-foundation",
    "",
    "Usage:",
    "  desktop-foundation doctor [options]",
    "  desktop-foundation ci [desktop-foundation-ci options]",
    "",
    "Commands:",
    "  doctor              Check whether the current product project follows the foundation contract.",
    "  ci                  Forward options to desktop-foundation-ci.",
    "",
    "Doctor options:",
    "  --report <path>     Write a JSON report. Maps to desktop-foundation-ci --integration-report.",
    "  --summary           Print grouped fail/warn next actions. Enabled by default for doctor.",
    "  --strict            Fail when the integration check has fail or warn findings.",
    "  --help              Show this help.",
    "",
    "Examples:",
    "  pnpm exec desktop-foundation doctor",
    "  pnpm exec desktop-foundation doctor --report artifacts/foundation-doctor.json",
    "  pnpm exec desktop-foundation ci --integration-check"
  ].join("\n"));
}

function runCi(args) {
  const result = spawnSync(process.execPath, [join(binDir, "desktop-foundation-ci.mjs"), ...args], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
    shell: false
  });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}

function readNext(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error("Missing value for " + flag + ".");
  return value;
}

function normalizeDoctorArgs(argv) {
  const args = ["--integration-check", "--integration-summary"];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    if (arg === "--report") {
      args.push("--integration-report", readNext(argv, index, arg));
      index += 1;
      continue;
    }
    args.push(arg);
  }
  return args;
}

try {
  const rawArgs = process.argv.slice(2);
  const directDoctor = invokedAs.includes("doctor");
  const command = directDoctor ? "doctor" : rawArgs.shift();

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    process.exit(0);
  }

  if (command === "doctor") {
    runCi(normalizeDoctorArgs(rawArgs));
  }

  if (command === "ci") {
    runCi(rawArgs);
  }

  throw new Error("Unknown command: " + command);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.error("");
  printHelp();
  process.exit(1);
}
