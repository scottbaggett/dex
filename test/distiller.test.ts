import { describe, it, expect } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { Distiller } from "../src/core/distiller";

describe("Distiller", () => {
  it.skip("distills a small TypeScript project (requires tree-sitter native)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "dex-distill-"));
    try {
      // Create a couple of files
      writeFileSync(
        join(dir, "src", "index.ts"),
        "export function add(a: number, b: number): number { return a + b }\n",
        { encoding: "utf-8", flag: "w" }
      );
    } catch {
      // Ensure subdir exists
      // macOS mkdtemp only creates the last segment; create src explicitly
      const srcPath = join(dir, "src");
      Bun.spawnSync(["mkdir", "-p", srcPath]);
      writeFileSync(
        join(srcPath, "index.ts"),
        "export function add(a: number, b: number): number { return a + b }\n",
        { encoding: "utf-8", flag: "w" }
      );
      writeFileSync(
        join(srcPath, "util.ts"),
        "export const twice = (n: number) => n * 2;\n",
        { encoding: "utf-8", flag: "w" }
      );
    }

    const distiller = new Distiller({ format: "distilled", compressFirst: true });
    const result: any = await distiller.distill(dir);

    // Basic structural assertions
    expect(result.structure.fileCount).toBeGreaterThan(0);
    expect(result.metadata.originalTokens).toBeGreaterThan(0);
    expect(result.metadata.distilledTokens).toBeGreaterThan(0);
    expect(Array.isArray(result.apis)).toBe(true);

    // It should include at least one exported symbol
    const hasExports = result.apis.some((api: any) => (api.exports?.length || 0) > 0);
    expect(hasExports).toBe(true);
  });
});

