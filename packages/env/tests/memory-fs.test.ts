import { describe, expect, test } from "vitest";
import { MemoryFsPromises } from "../src/fs/memory-impl.js";

describe("MemoryFsPromises (memfs replacement)", () => {
  test("writeFile/readFile supports utf8 and returns Uint8Array by default", async () => {
    const fs = new MemoryFsPromises();

    await fs.mkdir("/dir", { recursive: true });
    await fs.writeFile("/dir/foo.txt", "bar");

    const bytes = await fs.readFile("/dir/foo.txt");
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder("utf-8").decode(bytes as Uint8Array)).toBe("bar");

    const text = await fs.readFile("/dir/foo.txt", "utf8");
    expect(text).toBe("bar");
  });

  test("mkdir recursive creates intermediate directories; non-recursive fails when parent missing", async () => {
    const fs = new MemoryFsPromises();

    await fs.mkdir("/a/b/c", { recursive: true });
    await expect(fs.access("/a")).resolves.toBeUndefined();
    await expect(fs.access("/a/b")).resolves.toBeUndefined();
    await expect(fs.access("/a/b/c")).resolves.toBeUndefined();

    await expect(fs.mkdir("/x/y", { recursive: false })).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  test("access throws ENOENT for missing paths", async () => {
    const fs = new MemoryFsPromises();
    await expect(fs.access("/missing")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  test("readdir lists direct children only and is sorted", async () => {
    const fs = new MemoryFsPromises();

    await fs.mkdir("/d", { recursive: true });
    await fs.mkdir("/d/z", { recursive: true });
    await fs.mkdir("/d/a", { recursive: true });
    await fs.writeFile("/d/c.txt", "c");
    await fs.writeFile("/d/b.txt", "b");
    await fs.writeFile("/d/a/nested.txt", "nested");

    const entries = await fs.readdir("/d");
    expect(entries).toEqual(["a", "b.txt", "c.txt", "z"]);
  });

  test("stat identifies files vs directories", async () => {
    const fs = new MemoryFsPromises();

    await fs.mkdir("/stats", { recursive: true });
    await fs.writeFile("/stats/file.bin", new Uint8Array([1, 2, 3]));

    const dirStat = await fs.stat("/stats");
    expect(dirStat.isDirectory()).toBe(true);
    expect(dirStat.isFile()).toBe(false);

    const fileStat = await fs.stat("/stats/file.bin");
    expect(fileStat.isFile()).toBe(true);
    expect(fileStat.isDirectory()).toBe(false);
    expect(fileStat.size).toBe(3);
  });

  test("readFile throws EISDIR when path is a directory", async () => {
    const fs = new MemoryFsPromises();
    await fs.mkdir("/dir", { recursive: true });
    await expect(fs.readFile("/dir")).rejects.toMatchObject({ code: "EISDIR" });
  });
});
