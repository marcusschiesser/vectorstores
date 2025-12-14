/**
 * Remark plugin that replaces:
 *   <include cwd>../../examples/foo.ts</include>
 * with a fenced code block containing that file’s contents.
 *
 * `cwd` (boolean attribute) means the path is resolved relative to `docs/src/`.
 * Otherwise, paths are resolved relative to the current MDX file.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { visit } from "unist-util-visit";

function inferLang(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".ts":
    case ".mts":
    case ".cts":
      return "ts";
    case ".tsx":
      return "tsx";
    case ".js":
    case ".mjs":
    case ".cjs":
      return "js";
    case ".jsx":
      return "jsx";
    case ".json":
      return "json";
    case ".md":
    case ".mdx":
      return "md";
    case ".yml":
    case ".yaml":
      return "yml";
    case ".css":
      return "css";
    case ".sh":
      return "bash";
    default:
      return "text";
  }
}

function getAttribute(node, name) {
  const attrs = node.attributes || [];
  return attrs.find((a) => a && a.type === "mdxJsxAttribute" && a.name === name);
}

function getIncludePathText(node) {
  // <include>PATH</include> usually becomes a single text child.
  const children = node.children || [];
  const text = children
    .map((c) => (c && c.type === "text" ? c.value : ""))
    .join("")
    .trim();
  return text;
}

export default function remarkInclude() {
  return async (tree, file) => {
    const mdxFilePath =
      typeof file?.path === "string" ? path.resolve(String(file.path)) : null;

    visit(tree, "mdxJsxFlowElement", (node, index, parent) => {
      if (!parent || typeof index !== "number") return;
      if (node.name !== "include") return;

      const includePath = getIncludePathText(node);
      if (!includePath) {
        file.fail("`<include>` is missing a path.", node);
      }

      const hasCwd = Boolean(getAttribute(node, "cwd"));

      const baseDir = hasCwd
        ? path.resolve(process.cwd(), "src")
        : mdxFilePath
          ? path.dirname(mdxFilePath)
          : process.cwd();

      const resolvedPath = path.resolve(baseDir, includePath);

      // Replace node with an async placeholder we’ll fill later (needs async FS).
      // We store the promise on the node itself, then resolve after traversal.
      node.__includeResolvedPath = resolvedPath;
    });

    // Second pass: actually replace nodes with code blocks (async).
    const replacements = [];
    visit(tree, "mdxJsxFlowElement", (node, index, parent) => {
      if (!parent || typeof index !== "number") return;
      if (node.name !== "include") return;
      if (!node.__includeResolvedPath) return;
      replacements.push({ node, index, parent, filePath: node.__includeResolvedPath });
    });

    for (const { index, parent, filePath } of replacements) {
      let contents;
      try {
        contents = await fs.readFile(filePath, "utf8");
      } catch (err) {
        const rel = path.relative(process.cwd(), filePath);
        throw new Error(
          `Failed to read <include> file: ${rel}\n` +
            `Referenced from: ${file?.path ?? "(unknown)"}\n` +
            `Original error: ${err?.message ?? String(err)}`,
        );
      }

      parent.children.splice(index, 1, {
        type: "code",
        lang: inferLang(filePath),
        value: contents.replace(/\s+$/, ""), // trim trailing whitespace/newlines
      });
    }
  };
}


