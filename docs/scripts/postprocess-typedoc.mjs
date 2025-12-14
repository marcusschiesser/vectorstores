import { promises as fs } from "node:fs";
import path from "node:path";

const OUT_DIR = path.resolve(
  process.cwd(),
  "src/content/docs/api",
);

async function listFilesRecursive(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(fullPath)));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

function addFrontmatterIfMissing(content, title) {
  // Astro content collections require frontmatter; Typedoc markdown has none by default.
  if (content.startsWith("---\n")) return content;
  return `---\ntitle: ${JSON.stringify(title)}\n---\n\n${content}`;
}

function transformMarkdownLinksToLowercaseFilenames(content) {
  // Convert links like (classes/PGVectorStore.md) -> (classes/pgvectorstore.md)
  // while leaving external URLs / anchors untouched.
  return content.replace(/\]\(([^)]+)\)/g, (match, rawUrl) => {
    const url = String(rawUrl);
    if (
      url.startsWith("http://") ||
      url.startsWith("https://") ||
      url.startsWith("mailto:") ||
      url.startsWith("#")
    ) {
      return match;
    }

    const [beforeHash, hash = ""] = url.split("#");
    if (!beforeHash.endsWith(".md")) return match;

    const dir = path.posix.dirname(beforeHash);
    const base = path.posix.basename(beforeHash);
    const lowered = base.toLowerCase();
    const nextPath = dir === "." ? lowered : `${dir}/${lowered}`;
    const nextUrl = hash ? `${nextPath}#${hash}` : nextPath;
    return `](${nextUrl})`;
  });
}

async function main() {
  // If typedoc didn't generate output (or directory missing), no-op.
  try {
    await fs.access(OUT_DIR);
  } catch {
    return;
  }

  const allFiles = await listFilesRecursive(OUT_DIR);
  const mdFiles = allFiles.filter((f) => f.endsWith(".md"));

  // 1) Rewrite contents (frontmatter + link normalization).
  for (const file of mdFiles) {
    const rel = path.relative(OUT_DIR, file);
    const base = path.basename(file, ".md");
    const title = rel === "index.md" ? "API Reference" : base;

    const original = await fs.readFile(file, "utf8");
    const withLinks = transformMarkdownLinksToLowercaseFilenames(original);
    const withFrontmatter = addFrontmatterIfMissing(withLinks, title);

    if (withFrontmatter !== original) {
      await fs.writeFile(file, withFrontmatter, "utf8");
    }
  }

  // 2) Rename files to lowercase to match expected routes (/classes/pgvectorstore/).
  //    Do a two-step rename to avoid case-insensitive FS collisions.
  const renameOps = [];
  for (const file of mdFiles) {
    const base = path.basename(file);
    if (base === "index.md") continue;

    const lowered = base.toLowerCase();
    if (lowered === base) continue;

    const dir = path.dirname(file);
    const tmp = path.join(dir, `${base}.tmp__lowercase`);
    const target = path.join(dir, lowered);

    renameOps.push({ from: file, tmp, to: target });
  }

  for (const op of renameOps) await fs.rename(op.from, op.tmp);
  for (const op of renameOps) await fs.rename(op.tmp, op.to);
}

await main();


