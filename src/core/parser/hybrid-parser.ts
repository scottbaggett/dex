import { TreeSitterParser } from "./tree-sitter-parser";
import { RegexParser } from "./regex-parser";
import {
    Parser as BaseParser,
    type ParsedFile,
    type ParserOptions,
} from "./parser";
import type { ExtractedAPI } from "../../types";

/**
 * Hybrid parser that uses Tree-sitter for supported languages and falls back to regex for others
 */
export class HybridParser extends BaseParser {
    private treeSitterParser: TreeSitterParser;
    private regexParser: RegexParser;

    constructor(
        options: ParserOptions = {
            includeComments: false,
            includeDocstrings: true,
        },
    ) {
        super(options);
        this.treeSitterParser = new TreeSitterParser(options);
        this.regexParser = new RegexParser(options);
    }

    async initialize(): Promise<void> {
        try {
            await this.treeSitterParser.initialize();
        } catch (error) {
            console.warn(
                "Tree-sitter parser initialization failed, using regex fallback only",
            );
        }
        await this.regexParser.initialize();
    }

    async parse(content: string, language: string): Promise<ParsedFile> {
        // Try Tree-sitter first for supported languages
        if (this.treeSitterParser.isLanguageSupported(language)) {
            try {
                return await this.treeSitterParser.parse(content, language);
            } catch (error) {
                console.warn(
                    `Tree-sitter parsing failed for ${language}, falling back to regex:`,
                    error,
                );
                // Fall back to regex parser
                return await this.regexParser.parse(content, language);
            }
        }

        // Use regex parser for unsupported languages
        return await this.regexParser.parse(content, language);
    }

    extract(parsedFile: ParsedFile): ExtractedAPI {
        const { language, ast } = parsedFile;

        // If we have an AST (Tree-sitter), use Tree-sitter extraction
        if (ast && this.treeSitterParser.isLanguageSupported(language)) {
            try {
                return this.treeSitterParser.extract(parsedFile);
            } catch (error) {
                console.warn(
                    `Tree-sitter extraction failed for ${language}, falling back to regex:`,
                    error,
                );
                // Fall back to regex extraction
                return this.regexParser.extract(parsedFile);
            }
        }

        // Use regex extraction for unsupported languages or when AST is not available
        return this.regexParser.extract(parsedFile);
    }

    isLanguageSupported(language: string): boolean {
        return (
            this.treeSitterParser.isLanguageSupported(language) ||
            this.regexParser.isLanguageSupported(language)
        );
    }

    getSupportedLanguages(): string[] {
        const treeSitterLangs = this.treeSitterParser.getSupportedLanguages();
        const regexLangs = this.regexParser.getSupportedLanguages();

        // Combine and deduplicate
        return [...new Set([...treeSitterLangs, ...regexLangs])];
    }

    getTreeSitterSupportedLanguages(): string[] {
        return this.treeSitterParser.getSupportedLanguages();
    }

    getRegexSupportedLanguages(): string[] {
        return this.regexParser.getSupportedLanguages();
    }

    static override detectLanguage(filePath: string): string | null {
        return BaseParser.detectLanguage(filePath);
    }
}
