import fs from "node:fs/promises";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);
const repoRoot = path.resolve(here, "..");

const source = path.join(repoRoot, "README.md");
const dest = path.join(repoRoot, "packages", "core", "README.md");

const content = await fs.readFile(source, "utf8");
await fs.writeFile(dest, content, "utf8");

console.log(`synced README: ${path.relative(repoRoot, source)} -> ${path.relative(repoRoot, dest)}`);


