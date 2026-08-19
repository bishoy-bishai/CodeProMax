/**
 * @file file-manager.test.ts
 * @description Tests for FileManager: directory creation on write, graceful
 * not-found handling for read/exists/listDirectory.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm } from "fs/promises";
import { join } from "path";
import { FileManager } from "../file-manager.ts";

const root = join(process.cwd(), ".tmp-file-manager-test");

beforeEach(async () => {
  await mkdir(root, { recursive: true });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("FileManager", () => {
  const fm = new FileManager();

  it("writes a file, creating missing parent directories", async () => {
    const path = join(root, "a", "b", "c.md");
    await fm.write(path, "hello");
    expect(await fm.read(path)).toBe("hello");
  });

  it("overwrites existing content", async () => {
    const path = join(root, "d.md");
    await fm.write(path, "first");
    await fm.write(path, "second");
    expect(await fm.read(path)).toBe("second");
  });

  it("returns null when reading a missing file", async () => {
    expect(await fm.read(join(root, "missing.md"))).toBeNull();
  });

  it("reports existence correctly", async () => {
    const path = join(root, "exists.md");
    expect(await fm.exists(path)).toBe(false);
    await fm.write(path, "x");
    expect(await fm.exists(path)).toBe(true);
  });

  it("lists directory entries", async () => {
    await fm.write(join(root, "list", "one.md"), "1");
    await fm.write(join(root, "list", "two.md"), "2");
    const entries = await fm.listDirectory(join(root, "list"));
    expect(entries.sort()).toEqual(["one.md", "two.md"]);
  });

  it("returns an empty array for a missing directory", async () => {
    expect(await fm.listDirectory(join(root, "nope"))).toEqual([]);
  });
});
