#!/usr/bin/env node
import { rmSync } from "node:fs";
import { resolve, relative } from "node:path";

const target = resolve(process.cwd(), process.argv[2] || "dist");
const relativeTarget = relative(process.cwd(), target);

if (!relativeTarget || relativeTarget.startsWith("..") || relativeTarget.split(/[\\/]/).includes("..")) {
  console.error(`Refusing to clean outside the package directory: ${target}`);
  process.exit(1);
}

rmSync(target, { recursive: true, force: true });
