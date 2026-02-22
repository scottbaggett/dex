import { describe, expect, test } from "bun:test";
import { mapExportKind, toDependencies, toExtractedAPI } from "./normalize.js";
import type { ProcessResult } from "../languages/types.js";

describe("distiller normalize helpers", () => {
    test("maps non-core export kinds to const", () => {
        expect(mapExportKind("namespace")).toBe("const");
        expect(mapExportKind("let")).toBe("const");
        expect(mapExportKind("unknown-kind")).toBe("const");
    });

    test("converts ProcessResult into ExtractedAPI + dependency map", () => {
        const processResult: ProcessResult = {
            imports: [{ source: "react", specifiers: [] }],
            exports: [
                {
                    name: "Service",
                    kind: "class",
                    signature: "class Service",
                    line: 12,
                    visibility: "public",
                    members: [
                        {
                            name: "constructor",
                            kind: "constructor",
                            signature: "constructor()",
                        },
                        {
                            name: "value",
                            kind: "property",
                            signature: "value: string",
                        },
                    ],
                },
                {
                    name: "local",
                    kind: "let",
                    signature: "let local = 1",
                    line: 20,
                },
            ],
        };

        const api = toExtractedAPI("src/service.ts", processResult);
        const deps = toDependencies(processResult);

        expect(api.file).toBe("src/service.ts");
        expect(api.imports).toEqual(["react"]);
        expect(api.exports[0]?.type).toBe("class");
        expect(api.exports[0]?.members?.[0]?.type).toBe("method");
        expect(api.exports[0]?.members?.[1]?.type).toBe("property");
        expect(api.exports[1]?.type).toBe("const");
        expect(deps).toEqual({
            imports: ["react"],
            exports: ["Service", "local"],
        });
    });
});
