import { getLanguageRegistry, ProcessingOptions } from "../languages/index.js";
import { detectLanguage } from "../../utils/language-detection.js";
import { countTokens } from "../../utils/tokens.js";

interface WorkerInput {
	filePath: string;
	content: string;
	processingOptions: ProcessingOptions;
}

interface WorkerOutput {
	api: any | null;
	dependencies: { imports: string[]; exports: string[] } | null;
	originalTokens: number;
	language: string | null;
	error?: string;
}

/**
 * Worker function for processing a single file.
 * This runs in a separate thread for true parallelism.
 */
export default async function processFile({
	filePath,
	content,
	processingOptions,
}: WorkerInput): Promise<WorkerOutput> {
	const registry = getLanguageRegistry();
	await registry.initializeAll();

	const language = detectLanguage(filePath);
	
	if (!language || !registry.isFileSupported(filePath)) {
		return { api: null, dependencies: null, originalTokens: 0, language: null };
	}

	const originalTokens = countTokens(content);

	try {
		const result = await registry.processFile(
			filePath,
			content,
			processingOptions,
		);

		// Convert to ExtractedAPI format
		const extracted = {
			file: filePath,
			imports: result.imports.map((i: any) => i.source),
			exports: result.exports.map((e: any) => ({
				name: e.name,
				type: mapExportKind(e.kind),
				signature: e.signature,
				visibility: e.visibility || "public",
				location: {
					startLine: e.line || 0,
					endLine: e.line || 0,
				},
				members: e.members?.map((m: any) => ({
					name: m.name,
					signature: m.signature,
					type:
						m.kind === "constructor" ||
						m.kind === "getter" ||
						m.kind === "setter"
							? "method"
							: (m.kind as "property" | "method"),
				})),
			})),
		};

		const dependencies = {
			imports: result.imports.map((i: any) => i.source),
			exports: result.exports.map((e: any) => e.name),
		};

		return { api: extracted, dependencies, originalTokens, language };
	} catch (error) {
		if (process.env.DEBUG) {
			console.warn(`Failed to distill ${filePath}:`, error);
		}
		return { 
			api: null, 
			dependencies: null, 
			originalTokens, 
			language,
			error: error instanceof Error ? error.message : String(error)
		};
	}
}

function mapExportKind(
	kind: string,
): "function" | "class" | "interface" | "const" | "type" | "enum" {
	switch (kind) {
		case "function":
		case "class":
		case "interface":
		case "type":
		case "enum":
			return kind as any;
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