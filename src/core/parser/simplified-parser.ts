import { TreeSitterParser } from "./tree-sitter-parser";
import {
    Parser as BaseParser,
    type ParsedFile,
    type ParserOptions,
} from "./parser";
import type { ExtractedAPI } from "../../types";
import { Converter } from "./converter";
import { CanonicalAPI } from "./canonical-types";

/**
 * Simplified parser that only uses Tree-sitter for supported languages
 * Returns empty results for unsupported languages (no regex fallback)
 */
export class SimplifiedParser extends BaseParser {
    private treeSitterParser: TreeSitterParser;

    constructor(
        options: ParserOptions = {
            includeComments: false,
            includeDocstrings: true,
        },
    ) {
        super(options);
        this.treeSitterParser = new TreeSitterParser(options);
    }

    async initialize(): Promise<void> {
        await this.treeSitterParser.initialize();
    }

    async parse(content: string, language: string): Promise<ParsedFile> {
        // Only use Tree-sitter for supported languages
        if (this.treeSitterParser.isLanguageSupported(language)) {
            try {
                return await this.treeSitterParser.parse(content, language);
            } catch (error) {
                console.warn(
                    `Tree-sitter parsing failed for ${language}, returning empty result`,
                    error,
                );
                // Return empty parsed file on error
                return {
                    path: "",
                    language,
                    content,
                    ast: null,
                };
            }
        }

        // Return empty result for unsupported languages
        return {
            path: "",
            language,
            content,
            ast: null,
        };
    }

    extract(parsedFile: ParsedFile): ExtractedAPI {
        const { language, ast, content, path } = parsedFile;

        // If we have an AST (Tree-sitter), use Converter for extraction
        if (ast && this.treeSitterParser.isLanguageSupported(language)) {
            try {
                // Use converter to transform AST to canonical format
                const converter = new Converter(language, content);
                const canonical = converter.convertTree(ast);
                
                // Transform canonical to ExtractedAPI format
                return this.canonicalToExtractedAPI(canonical, path);
            } catch (error) {
                console.warn(
                    `Extraction failed for ${language}, returning empty result`,
                    error,
                );
                // Return empty extraction on error
                return {
                    file: path || "",
                    imports: [],
                    exports: [],
                };
            }
        }

        // Return empty result for unsupported languages
        return {
            file: path || "",
            imports: [],
            exports: [],
        };
    }

    /**
     * Convert canonical API to ExtractedAPI format
     */
    private canonicalToExtractedAPI(canonical: CanonicalAPI, filePath: string): ExtractedAPI {
        const exports = canonical.exports.map(exp => ({
            name: exp.name,
            type: exp.type as any,
            signature: exp.signature,
            visibility: 'public' as const,
            location: {
                startLine: 0,
                endLine: 0,
            },
            members: exp.members?.map(m => ({
                name: m.name,
                signature: m.signature,
                type: m.type,
            })),
        }));

        // Convert imports to simple string array
        const imports = canonical.imports.map(imp => 
            imp.specifiers.length > 0 
                ? `${imp.specifiers.join(', ')} from '${imp.source}'`
                : `'${imp.source}'`
        );

        return {
            file: filePath,
            imports,
            exports,
        };
    }

    isLanguageSupported(language: string): boolean {
        return this.treeSitterParser.isLanguageSupported(language);
    }

    getSupportedLanguages(): string[] {
        return this.treeSitterParser.getSupportedLanguages();
    }

    static override detectLanguage(filePath: string): string | null {
        return BaseParser.detectLanguage(filePath);
    }
}