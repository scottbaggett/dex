import type { ExtractedAPI } from "../../types.js";
import type { ProcessResult } from "../languages/types.js";

type ExtractedType = ExtractedAPI["exports"][number]["type"];

function normalizeMemberKind(kind: string): "property" | "method" {
    if (kind === "constructor" || kind === "getter" || kind === "setter") {
        return "method";
    }
    return kind === "property" ? "property" : "method";
}

export function mapExportKind(kind: string): ExtractedType {
    switch (kind) {
        case "function":
        case "class":
        case "interface":
        case "type":
        case "enum":
            return kind;
        case "const":
        case "let":
        case "var":
        case "namespace":
        case "module":
            return "const";
        default:
            return "const";
    }
}

export function toExtractedAPI(
    filePath: string,
    processResult: ProcessResult,
): ExtractedAPI {
    return {
        file: filePath,
        imports: processResult.imports.map((imp) => imp.source),
        exports: processResult.exports.map((exp) => ({
            name: exp.name,
            type: mapExportKind(exp.kind),
            signature: exp.signature,
            visibility: exp.visibility || "public",
            location: {
                startLine: exp.line || 0,
                endLine: exp.line || 0,
            },
            members: exp.members?.map((member) => ({
                name: member.name,
                signature: member.signature,
                type: normalizeMemberKind(member.kind),
            })),
        })),
    };
}

export function toDependencies(processResult: ProcessResult): {
    imports: string[];
    exports: string[];
} {
    return {
        imports: processResult.imports.map((imp) => imp.source),
        exports: processResult.exports.map((exp) => exp.name),
    };
}
