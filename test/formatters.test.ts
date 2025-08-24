import { describe, it, expect } from "bun:test";
import { MarkdownFormatter } from "../src/templates/markdown";
import { JsonFormatter } from "../src/templates/json";
import { XmlFormatter } from "../src/templates/xml";
import type { ExtractedContext, DexOptions } from "../src/types";

function makeContext(overrides: Partial<ExtractedContext> = {}): ExtractedContext {
  return {
    changes: [
      {
        file: "src/app.ts",
        status: "modified",
        additions: 3,
        deletions: 1,
        diff: "@@\n+const a=1;\n-const b=2;",
      },
    ],
    scope: {
      filesChanged: 1,
      functionsModified: 0,
      linesAdded: 3,
      linesDeleted: 1,
    },
    metadata: {
      generated: new Date().toISOString(),
      repository: { name: "repo", branch: "main", commit: "abc123" },
      extraction: { method: "staged", filters: {} },
      tokens: { estimated: 42 },
      tool: { name: "dex", version: "0.0.0" },
    },
    ...overrides,
  } as ExtractedContext;
}

describe("Formatters", () => {
  const options: DexOptions = { format: "markdown" };

  it("renders markdown with code fences and diff", () => {
    const ctx = makeContext();
    const out = new MarkdownFormatter().format({ context: ctx, options });
    expect(out).toContain("## Changes");
    expect(out).toContain("```diff");
    expect(out).toContain("+ const a=1;");
  });

  it("renders json parsable output", () => {
    const ctx = makeContext();
    const json = new JsonFormatter().format({ context: ctx, options });
    const parsed = JSON.parse(json);
    expect(parsed.scope.filesChanged).toBe(1);
    expect(parsed.changes[0].file).toBe("src/app.ts");
  });

  it("renders xml with escaped content", () => {
    const ctx = makeContext();
    const xml = new XmlFormatter().format({ context: ctx, options });
    expect(xml.startsWith("<?xml")).toBe(true);
    expect(xml).toContain("<changes>");
    expect(xml).toContain("<![CDATA[");
  });
});

