import { getLanguageRegistry, ProcessingOptions } from "../languages/index.js";
import { detectLanguage } from "../../utils/language-detection.js";
import { countTokens } from "../../utils/tokens.js";
import { toDependencies, toExtractedAPI } from "./normalize.js";

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

			const extracted = toExtractedAPI(filePath, result);
			const dependencies = toDependencies(result);

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
