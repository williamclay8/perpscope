import { copyFileSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const out = fileURLToPath(new URL("../dist/", import.meta.url));

const roots = [
  "index.html",
  "favicon.svg",
  "src",
  "examples",
  "schemas",
  "packages",
  "docs"
];
const IGNORED_DIRECTORIES = new Set(["node_modules", "dist"]);

function listFiles(relativePath) {
  const absolutePath = join(root, relativePath);
  const stat = statSync(absolutePath);

  if (stat.isFile()) return [relativePath];

  return readdirSync(absolutePath).flatMap((entry) => {
    if (IGNORED_DIRECTORIES.has(entry)) return [];
    const child = join(relativePath, entry);
    const childStat = statSync(join(root, child));
    if (childStat.isDirectory()) return listFiles(child);
    if (childStat.isFile()) return [child];
    return [];
  });
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const files = roots.flatMap(listFiles);
console.log(`build-static: copying ${files.length} files`);

for (const file of files) {
  const destination = join(out, file);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(join(root, file), destination);
}

console.log("build-static: wrote dist/");
