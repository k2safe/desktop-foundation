import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "dist");

async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveSpecifier(filePath, specifier) {
  if (!specifier.startsWith("./") && !specifier.startsWith("../")) return specifier;
  if (path.extname(specifier)) return specifier;

  const base = path.resolve(path.dirname(filePath), specifier);
  if (await pathExists(`${base}.js`)) return `${specifier}.js`;
  if (await pathExists(path.join(base, "index.js"))) return `${specifier}/index.js`;
  return specifier;
}

async function patchFile(filePath) {
  const source = await readFile(filePath, "utf8");
  const replacements = [];
  const patterns = [
    /(from\s+["'])(\.{1,2}\/[^"']+)(["'])/g,
    /(import\s+["'])(\.{1,2}\/[^"']+)(["'])/g
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      replacements.push({
        start: match.index,
        end: match.index + match[0].length,
        prefix: match[1],
        specifier: match[2],
        suffix: match[3]
      });
    }
  }

  if (!replacements.length) return;

  let next = "";
  let cursor = 0;
  for (const replacement of replacements.sort((a, b) => a.start - b.start)) {
    next += source.slice(cursor, replacement.start);
    const specifier = await resolveSpecifier(filePath, replacement.specifier);
    next += `${replacement.prefix}${specifier}${replacement.suffix}`;
    cursor = replacement.end;
  }
  next += source.slice(cursor);

  if (next !== source) await writeFile(filePath, next);
}

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(filePath);
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      await patchFile(filePath);
    }
  }
}

await walk(root);
