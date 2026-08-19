/**
 * @file file-manager.ts
 * @description Thin, robust wrapper around node:fs/promises for the commands
 * layer. Every write ensures its parent directory exists; every read
 * distinguishes "not found" from a genuine I/O error so callers can handle
 * missing files without a try/catch around every call site.
 */

import { mkdir, readdir, readFile, stat, writeFile } from "fs/promises";
import { dirname } from "path";

export class FileManager {
  /** Write a file, creating any missing parent directories. Overwrites existing content. */
  async write(path: string, content: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, "utf-8");
  }

  /** Read a file. Returns null if the file does not exist; rethrows other I/O errors. */
  async read(path: string): Promise<string | null> {
    try {
      return await readFile(path, "utf-8");
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }

  /** Check whether a path exists (file or directory). */
  async exists(path: string): Promise<boolean> {
    try {
      await stat(path);
      return true;
    } catch (err) {
      if (isNotFound(err)) return false;
      throw err;
    }
  }

  /** List entry names in a directory. Returns an empty array if the directory does not exist. */
  async listDirectory(path: string): Promise<string[]> {
    try {
      return await readdir(path);
    } catch (err) {
      if (isNotFound(err)) return [];
      throw err;
    }
  }
}

function isNotFound(err: unknown): boolean {
  return err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT";
}
