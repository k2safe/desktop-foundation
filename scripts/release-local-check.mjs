#!/usr/bin/env node
import { spawn } from "node:child_process";

const checks = [
  {
    name: "package manifest drift",
    command: "pnpm",
    args: ["release:check-package-drift", "--", "--manifest", "artifacts/npm/foundation-packages.json"]
  },
  {
    name: "multipart upload smoke",
    command: "pnpm",
    args: ["smoke:multipart"]
  },
  {
    name: "clean external AI demo smoke",
    command: "pnpm",
    args: ["smoke:external-ai-demo"]
  },
  {
    name: "TypeScript package build and type-check",
    command: "pnpm",
    args: ["type-check"]
  },
  {
    name: "Rust core tests",
    command: "cargo",
    args: ["test", "--locked"]
  },
  {
    name: "Rust core tests with reqwest feature",
    command: "cargo",
    args: ["test", "--locked", "--features", "http-reqwest"]
  }
];

function bin(command) {
  return process.platform === "win32" ? `${command}.cmd` : command;
}

async function runCheck(check) {
  const startedAt = Date.now();
  console.log(`\nrelease-local-check: ${check.name}`);
  console.log(`$ ${check.command} ${check.args.join(" ")}`);

  await new Promise((resolve, reject) => {
    const child = spawn(bin(check.command), check.args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${check.name} failed with ${signal || `exit code ${code}`}`));
      }
    });
  });

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`release-local-check: ${check.name} ok (${seconds}s)`);
}

const startedAt = Date.now();

try {
  for (const check of checks) {
    await runCheck(check);
  }

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\nrelease-local-check: ok (${seconds}s)`);
} catch (error) {
  console.error(`\nrelease-local-check: failed`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
