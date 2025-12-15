/**
 * Minimal in-memory filesystem used in non-Node runtimes (browser/edge/workerd).
 *
 * This is intentionally tiny: it only implements the subset of `fs.promises`
 * APIs that `@vectorstores/core` uses.
 */

export type Encoding = "utf8" | "utf-8";

type StatLike = {
  isFile(): boolean;
  isDirectory(): boolean;
  size: number;
  mtimeMs: number;
};

type DirEntry = {
  name: string;
  kind: "file" | "dir";
};

function normalizePath(p: string): string {
  // Keep it POSIX-like across runtimes.
  if (!p) return "/";
  let path = p.replace(/\\/g, "/");
  if (!path.startsWith("/")) path = `/${path}`;
  // Collapse duplicate slashes.
  path = path.replace(/\/+/g, "/");
  // Remove trailing slash (except root).
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  // Resolve "." and ".."
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return "/" + parts.join("/");
}

function dirname(p: string): string {
  const path = normalizePath(p);
  if (path === "/") return "/";
  const idx = path.lastIndexOf("/");
  return idx <= 0 ? "/" : path.slice(0, idx);
}

function basename(p: string): string {
  const path = normalizePath(p);
  if (path === "/") return "/";
  const idx = path.lastIndexOf("/");
  return idx < 0 ? path : path.slice(idx + 1);
}

function utf8Bytes(input: string): Uint8Array {
  return new TextEncoder().encode(input);
}

function isEncoding(v: unknown): v is Encoding {
  return v === "utf8" || v === "utf-8";
}

class NodeStat implements StatLike {
  constructor(
    private kind: "file" | "dir",
    public size: number,
    public mtimeMs: number,
  ) {}
  isFile(): boolean {
    return this.kind === "file";
  }
  isDirectory(): boolean {
    return this.kind === "dir";
  }
}

export class MemoryFsPromises {
  private files = new Map<string, Uint8Array>();
  private dirs = new Set<string>(["/"]);
  private mtimes = new Map<string, number>();

  private touch(path: string) {
    this.mtimes.set(path, Date.now());
  }

  private ensureDirExists(dirPath: string) {
    const dir = normalizePath(dirPath);
    if (!this.dirs.has(dir)) {
      const err = new Error(
        `ENOENT: no such file or directory, mkdir '${dir}'`,
      );
      // best-effort Node-ish shape
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (err as any).code = "ENOENT";
      throw err;
    }
  }

  private ensureParentDirs(path: string, recursive: boolean) {
    const parent = dirname(path);
    if (this.dirs.has(parent)) return;
    if (!recursive) {
      const err = new Error(
        `ENOENT: no such file or directory, mkdir '${parent}'`,
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (err as any).code = "ENOENT";
      throw err;
    }
    // create chain
    const parts = normalizePath(parent).split("/").filter(Boolean);
    let cur = "/";
    for (const part of parts) {
      cur = cur === "/" ? `/${part}` : `${cur}/${part}`;
      this.dirs.add(cur);
      this.touch(cur);
    }
  }

  async access(pathLike: string): Promise<void> {
    const path = normalizePath(pathLike);
    if (this.files.has(path) || this.dirs.has(path)) return;
    const err = new Error(
      `ENOENT: no such file or directory, access '${path}'`,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (err as any).code = "ENOENT";
    throw err;
  }

  async mkdir(
    pathLike: string,
    options?: { recursive?: boolean } | boolean,
  ): Promise<void> {
    const path = normalizePath(pathLike);
    const recursive =
      typeof options === "boolean" ? options : Boolean(options?.recursive);
    if (path === "/") return;
    if (this.files.has(path)) {
      const err = new Error(`ENOTDIR: not a directory, mkdir '${path}'`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (err as any).code = "ENOTDIR";
      throw err;
    }
    this.ensureParentDirs(path, recursive);
    this.dirs.add(path);
    this.touch(path);
  }

  async writeFile(
    pathLike: string,
    data: string | Uint8Array,
    options?: { encoding?: Encoding } | Encoding,
  ): Promise<void> {
    const path = normalizePath(pathLike);
    const enc =
      typeof options === "string"
        ? options
        : isEncoding(options?.encoding)
          ? options?.encoding
          : undefined;
    const bytes =
      typeof data === "string"
        ? utf8Bytes(data)
        : data instanceof Uint8Array
          ? data
          : utf8Bytes(String(data));
    // Allow writing to root? mimic Node: root is a directory.
    if (path === "/") {
      const err = new Error(
        `EISDIR: illegal operation on a directory, open '/'`,
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (err as any).code = "EISDIR";
      throw err;
    }
    // Ensure parent dir exists (mkdir isn't always called by callers).
    this.ensureParentDirs(path, true);
    // If a directory exists with same name, error.
    if (this.dirs.has(path)) {
      const err = new Error(
        `EISDIR: illegal operation on a directory, open '${path}'`,
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (err as any).code = "EISDIR";
      throw err;
    }
    // Copy to avoid retaining external mutable buffer.
    this.files.set(path, bytes.slice());
    this.touch(path);
    // encoding is accepted for compatibility but ignored for storage.
    void enc;
  }

  async readFile(
    pathLike: string,
    options?: { encoding?: Encoding } | Encoding,
  ): Promise<Uint8Array | string> {
    const path = normalizePath(pathLike);
    const enc =
      typeof options === "string"
        ? options
        : isEncoding(options?.encoding)
          ? options?.encoding
          : undefined;
    if (this.dirs.has(path)) {
      const err = new Error(
        `EISDIR: illegal operation on a directory, read '${path}'`,
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (err as any).code = "EISDIR";
      throw err;
    }
    const data = this.files.get(path);
    if (!data) {
      const err = new Error(
        `ENOENT: no such file or directory, open '${path}'`,
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (err as any).code = "ENOENT";
      throw err;
    }
    if (enc) {
      return new TextDecoder(enc).decode(data);
    }
    return data.slice();
  }

  async readdir(dirPathLike: string): Promise<string[]> {
    const dirPath = normalizePath(dirPathLike);
    this.ensureDirExists(dirPath);
    const entries: DirEntry[] = [];

    for (const d of this.dirs) {
      if (d === "/") continue;
      if (dirname(d) === dirPath) {
        entries.push({ name: basename(d), kind: "dir" });
      }
    }
    for (const f of this.files.keys()) {
      if (dirname(f) === dirPath) {
        entries.push({ name: basename(f), kind: "file" });
      }
    }
    // Node returns lexicographically sorted names.
    entries.sort((a, b) => a.name.localeCompare(b.name));
    return entries.map((e) => e.name);
  }

  async stat(pathLike: string): Promise<StatLike> {
    const path = normalizePath(pathLike);
    if (this.files.has(path)) {
      const data = this.files.get(path)!;
      return new NodeStat("file", data.byteLength, this.mtimes.get(path) ?? 0);
    }
    if (this.dirs.has(path)) {
      return new NodeStat("dir", 0, this.mtimes.get(path) ?? 0);
    }
    const err = new Error(`ENOENT: no such file or directory, stat '${path}'`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (err as any).code = "ENOENT";
    throw err;
  }
}
