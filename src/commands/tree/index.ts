import { Command } from "commander";
import chalk from "chalk";
import { Distiller } from "../../core/distiller/index.js";
import type {
    DistillerOptions,
    ExtractedAPI,
    ProjectStructure,
} from "../../types.js";
import { promises as fs } from "fs";
import { resolve, basename, relative } from "path";
import clipboardy from "clipboardy";
import { loadConfig } from "../../core/config.js";
import { OutputManager } from "../../utils/output-manager.js";

export interface TreeOptions {
    depth?: string;
    format?: "tree" | "outline" | "json";
    output?: string;
    stdout?: boolean;
    clipboard?: boolean;
    exclude?: string[];
    includePrivate?: boolean;
    showTypes?: boolean;
    showParams?: boolean;
    groupBy?: "file" | "type" | "none";
}

export function createTreeCommand(): Command {
    const command = new Command("tree");

    command
        .description("Generate visual trees of codebase APIs and structure")
        .argument(
            "[path]",
            "Path to directory to analyze (defaults to current directory)",
        )

        .option(
            "-f, --format <type>",
            "Tree format (tree, outline, json)",
            "tree",
        )
        .option("-o, --output <file>", "Write output to specific file")
        .option("--stdout", "Print output to stdout")
        .option("-c, --clipboard", "Copy output to clipboard")
        .option("--exclude <patterns...>", "Exclude file patterns")
        .option("--include-private", "Include private/internal APIs")
        .option("--show-types", "Show parameter and return types")
        .option("--show-params", "Show function parameters")
        .option(
            "--group-by <method>",
            "Group APIs by file, type, or none",
            "file",
        )
        .action((...args: any[]) => {
            // Handle optional path argument - if no path provided, args[0] will be the command object
            const targetPath = typeof args[0] === "string" ? args[0] : ".";
            const cmdObject = args[args.length - 1]; // Commander puts the command object last
            const localOptions = cmdObject.opts();
            const parentOptions = cmdObject.parent?.opts() || {};

            // Merge parent and local options
            const options = { ...parentOptions, ...localOptions };

            return treeCommand(targetPath, options);
        });

    return command;
}

async function treeCommand(targetPath: string, options: any): Promise<void> {
    try {
        // Load config
        const config = loadConfig();

        // Resolve path
        const resolvedPath = resolve(targetPath);

        // Check if path exists
        try {
            await fs.access(resolvedPath);
        } catch {
            console.error(chalk.red(`Path not found: ${targetPath}`));
            process.exit(1);
        }

        // Build distiller options
        const configExcludes = config.distiller?.excludePatterns || [];
        const cliExcludes = Array.isArray(options.exclude)
            ? options.exclude
            : [];

        const distillerOptions: DistillerOptions = {
            path: resolvedPath,
            exclude: [...configExcludes, ...cliExcludes],
            include: [],
            excludePatterns: [...configExcludes, ...cliExcludes],
            includeComments: false,
            includeDocstrings: true,
            format: "txt",
            parallel: true,
        };

        console.log(chalk.cyan("✨Generating Tree..."));

        // Create distiller and extract APIs
        const distiller = new Distiller(distillerOptions);
        const result = await distiller.distill(resolvedPath);

        if (!("apis" in result)) {
            console.error(
                chalk.red(
                    "No API information extracted. Try a different depth level.",
                ),
            );
            process.exit(1);
        }

        // Determine if output should be formatted for terminal (with colors/icons)
        const forTerminal = options.stdout || false;

        // Generate tree visualization
        const tree = generateTree(
            result.apis,
            result.structure,
            options,
            resolvedPath,
            forTerminal,
        );

        // Handle output
        await handleOutput(tree, options, resolvedPath);
    } catch (error) {
        console.error(
            chalk.red(
                `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
            ),
        );
        if (process.env.DEBUG) {
            console.error(error);
        }
        process.exit(1);
    }
}

function generateTree(
    apis: ExtractedAPI[],
    structure: ProjectStructure | undefined,
    options: TreeOptions,
    basePath: string,
    forTerminal: boolean = false,
): string {
    const { format, groupBy, includePrivate, showTypes, showParams } = options;

    if (format === "json") {
        return JSON.stringify({ apis, structure }, null, 2);
    }

    // Flatten exports from all APIs and filter based on options
    const allExports = apis.flatMap((api) =>
        api.exports.map((exp) => ({ ...exp, file: api.file })),
    );

    const filteredExports = allExports.filter((exp) => {
        if (
            !includePrivate &&
            (exp.visibility === "private" || exp.name.startsWith("_"))
        ) {
            return false;
        }
        return true;
    });

    if (format === "outline") {
        return generateOutline(
            filteredExports,
            basePath,
            showTypes,
            showParams,
            forTerminal,
        );
    }

    // Default: tree format
    return generateTreeFormat(
        filteredExports,
        structure,
        groupBy!,
        basePath,
        showTypes,
        showParams,
        forTerminal,
    );
}

function generateTreeFormat(
    exports: any[],
    structure: ProjectStructure | undefined,
    groupBy: string,
    basePath: string,
    showTypes?: boolean,
    showParams?: boolean,
    forTerminal: boolean = false,
): string {
    if (groupBy === "file") {
        return generateTreeByFile(
            exports,
            basePath,
            showTypes,
            showParams,
            forTerminal,
        );
    } else if (groupBy === "type") {
        return generateTreeByType(exports, showTypes, showParams, forTerminal);
    } else {
        return generateFlatTree(exports, showTypes, showParams, forTerminal);
    }
}

function generateTreeByFile(
    exports: any[],
    basePath: string,
    showTypes?: boolean,
    showParams?: boolean,
    forTerminal: boolean = false,
): string {
    const lines: string[] = [];

    // Group exports by file
    const exportsByFile = new Map<string, any[]>();

    for (const exp of exports) {
        const relativePath = relative(basePath, exp.file);
        if (!exportsByFile.has(relativePath)) {
            exportsByFile.set(relativePath, []);
        }
        exportsByFile.get(relativePath)!.push(exp);
    }

    // Build directory tree structure
    const tree = buildDirectoryTree(Array.from(exportsByFile.keys()));

    lines.push(
        forTerminal
            ? chalk.bold.cyan(`📁 ${basename(basePath)}`)
            : basename(basePath),
    );

    renderDirectoryTree(
        tree,
        exportsByFile,
        lines,
        "",
        true,
        showTypes,
        showParams,
        forTerminal,
    );

    return lines.join("\n");
}

interface TreeNode {
    name: string;
    children: Map<string, TreeNode>;
    files: string[];
    isDirectory: boolean;
}

function buildDirectoryTree(filePaths: string[]): TreeNode {
    const root: TreeNode = {
        name: "",
        children: new Map(),
        files: [],
        isDirectory: true,
    };

    for (const filePath of filePaths) {
        const parts = filePath.split("/").filter((part) => part.length > 0);
        let current = root;

        // Build directory structure
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!current.children.has(part as any)) {
                current.children.set(part as any, {
                    name: part || "",
                    children: new Map(),
                    files: [],
                    isDirectory: true,
                });
            }
            current = current.children.get(part as any)!;
        }

        // Add the file
        if (parts.length > 0) {
            current.files.push(filePath);
        }
    }

    return root;
}

function renderDirectoryTree(
    node: TreeNode,
    exportsByFile: Map<string, any[]>,
    lines: string[],
    prefix: string,
    isLast: boolean,
    showTypes?: boolean,
    showParams?: boolean,
    forTerminal: boolean = false,
): void {
    // Render directories first, then files
    const directories = Array.from(node.children.entries()).sort(([a], [b]) =>
        a.localeCompare(b),
    );
    const files = node.files.sort();

    const totalItems = directories.length + files.length;
    let itemIndex = 0;

    // Render directories
    for (const [dirName, dirNode] of directories) {
        const isLastItem = itemIndex === totalItems - 1;
        const dirPrefix = isLastItem ? "└── " : "├── ";
        const dirIcon = forTerminal ? "📁 " : "";
        const dirColor = forTerminal ? chalk.blue.bold : (text: string) => text;

        lines.push(`${prefix}${dirPrefix}${dirIcon}${dirColor(dirName)}/`);

        const nextPrefix = prefix + (isLastItem ? "    " : "│   ");
        renderDirectoryTree(
            dirNode,
            exportsByFile,
            lines,
            nextPrefix,
            true,
            showTypes,
            showParams,
            forTerminal,
        );

        itemIndex++;
    }

    // Render files
    for (const filePath of files) {
        const isLastItem = itemIndex === totalItems - 1;
        const filePrefix = isLastItem ? "└── " : "├── ";
        const fileName = filePath.split("/").pop() || filePath;

        lines.push(
            `${prefix}${filePrefix}${forTerminal ? chalk.blue(fileName) : fileName}`,
        );

        // Render exports for this file
        const fileExports = exportsByFile.get(filePath) || [];
        const sortedExports = fileExports.sort((a, b) => {
            if (a.type !== b.type) {
                const typeOrder = {
                    class: 0,
                    function: 1,
                    interface: 2,
                    type: 3,
                    const: 4,
                    enum: 5,
                };
                return (
                    (typeOrder[a.type as keyof typeof typeOrder] || 99) -
                    (typeOrder[b.type as keyof typeof typeOrder] || 99)
                );
            }
            return a.name.localeCompare(b.name);
        });

        for (let j = 0; j < sortedExports.length; j++) {
            const exp = sortedExports[j];
            const isLastExport = j === sortedExports.length - 1;
            const baseIndent = prefix + (isLastItem ? "    " : "│   ");
            const exportPrefix = isLastExport ? "└── " : "├── ";

            const typeIcon = getTypeIcon(exp.type, forTerminal);
            const typeColor = getTypeColor(exp.type, forTerminal);
            const formattedName = typeColor(exp.name);

            let exportLine = `${baseIndent}${exportPrefix}${typeIcon}${typeIcon ? " " : ""}${formattedName}`;

            if (showTypes && exp.signature) {
                exportLine += forTerminal
                    ? chalk.gray(` ${exp.signature}`)
                    : ` ${exp.signature}`;
            }

            if (exp.visibility === "private") {
                exportLine += forTerminal
                    ? chalk.dim(" [private]")
                    : " [private]";
            }

            lines.push(exportLine);

            // Add description if available
            if (exp.docstring) {
                const descIndent =
                    baseIndent + (isLastExport ? "    " : "│   ");
                const desc =
                    exp.docstring.slice(0, 80) +
                    (exp.docstring.length > 80 ? "..." : "");
                lines.push(
                    `${descIndent}${forTerminal ? chalk.dim(desc) : desc}`,
                );
            }
        }

        itemIndex++;
    }
}

function generateTreeByType(
    exports: any[],
    showTypes?: boolean,
    showParams?: boolean,
    forTerminal: boolean = false,
): string {
    const lines: string[] = [];

    // Group exports by type
    const exportsByType = new Map<string, any[]>();

    for (const exp of exports) {
        if (!exportsByType.has(exp.type)) {
            exportsByType.set(exp.type, []);
        }
        exportsByType.get(exp.type)!.push(exp);
    }

    const typeOrder = [
        "class",
        "interface",
        "type",
        "function",
        "const",
        "enum",
    ];
    const sortedTypes = Array.from(exportsByType.keys()).sort((a, b) => {
        const aIndex = typeOrder.indexOf(a);
        const bIndex = typeOrder.indexOf(b);
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return a.localeCompare(b);
    });

    lines.push(forTerminal ? chalk.bold.cyan("APIs by Type") : "APIs by Type");

    for (let i = 0; i < sortedTypes.length; i++) {
        const type = sortedTypes[i] as string;
        const typeExports = exportsByType.get(type)!;
        const isLast = i === sortedTypes.length - 1;
        const typePrefix = isLast ? "└── " : "├── ";
        const typeIcon = getTypeIcon(type, forTerminal);
        const typeColor = getTypeColor(type, forTerminal);

        lines.push(
            `${typePrefix}${typeIcon}${typeIcon ? " " : ""}${typeColor(type.toUpperCase())} (${typeExports.length})`,
        );

        const sortedExports = typeExports.sort((a, b) =>
            a.name.localeCompare(b.name),
        );

        for (let j = 0; j < sortedExports.length; j++) {
            const exp = sortedExports[j];
            const isLastExport = j === sortedExports.length - 1;
            const baseIndent = isLast ? "    " : "│   ";
            const exportPrefix = isLastExport ? "└── " : "├── ";

            let exportLine = `${baseIndent}${exportPrefix}${exp.name}`;

            if (showTypes && exp.signature) {
                exportLine += forTerminal
                    ? chalk.gray(` ${exp.signature}`)
                    : ` ${exp.signature}`;
            }

            exportLine += forTerminal
                ? chalk.dim(` ${relative(process.cwd(), exp.file)}`)
                : ` ${relative(process.cwd(), exp.file)}`;

            if (exp.visibility === "private") {
                exportLine += forTerminal
                    ? chalk.dim(" [private]")
                    : " [private]";
            }

            lines.push(exportLine);
        }

        if (i < sortedTypes.length - 1) {
            lines.push(isLast ? "" : "│");
        }
    }

    return lines.join("\n");
}

function generateFlatTree(
    exports: any[],
    showTypes?: boolean,
    showParams?: boolean,
    forTerminal: boolean = false,
): string {
    const lines: string[] = [];

    lines.push(forTerminal ? chalk.bold.cyan("All APIs") : "All APIs");

    const sortedExports = exports.sort((a, b) => {
        if (a.type !== b.type) {
            const typeOrder = {
                class: 0,
                function: 1,
                interface: 2,
                type: 3,
                const: 4,
                enum: 5,
            };
            return (
                (typeOrder[a.type as keyof typeof typeOrder] || 99) -
                (typeOrder[b.type as keyof typeof typeOrder] || 99)
            );
        }
        return a.name.localeCompare(b.name);
    });

    for (let i = 0; i < sortedExports.length; i++) {
        const exp = sortedExports[i];
        const isLast = i === sortedExports.length - 1;
        const prefix = isLast ? "└── " : "├── ";

        const typeIcon = getTypeIcon(exp.type, forTerminal);
        const typeColor = getTypeColor(exp.type, forTerminal);

        let line = `${prefix}${typeIcon}${typeIcon ? " " : ""}${typeColor(exp.name)}`;

        if (showTypes && exp.signature) {
            line += forTerminal
                ? chalk.gray(` ${exp.signature}`)
                : ` ${exp.signature}`;
        }

        line += forTerminal
            ? chalk.dim(` ${relative(process.cwd(), exp.file)}`)
            : ` ${relative(process.cwd(), exp.file)}`;

        if (exp.visibility === "private") {
            line += forTerminal ? chalk.dim(" [private]") : " [private]";
        }

        lines.push(line);

        if (exp.docstring) {
            const desc =
                exp.docstring.slice(0, 100) +
                (exp.docstring.length > 100 ? "..." : "");
            const indent = isLast ? "    " : "│   ";
            lines.push(`${indent}${forTerminal ? chalk.dim(desc) : desc}`);
        }
    }

    return lines.join("\n");
}

function generateOutline(
    exports: any[],
    basePath: string,
    showTypes?: boolean,
    showParams?: boolean,
    forTerminal: boolean = false,
): string {
    const lines: string[] = [];

    lines.push(`# API Outline for ${basename(basePath)}\n`);

    // Group by file
    const exportsByFile = new Map<string, any[]>();

    for (const exp of exports) {
        const relativePath = relative(basePath, exp.file);
        if (!exportsByFile.has(relativePath)) {
            exportsByFile.set(relativePath, []);
        }
        exportsByFile.get(relativePath)!.push(exp);
    }

    const sortedFiles = Array.from(exportsByFile.keys()).sort();

    for (const file of sortedFiles) {
        const fileExports = exportsByFile.get(file)!;

        lines.push(`## ${file}\n`);

        const sortedExports = fileExports.sort((a, b) => {
            if (a.type !== b.type) {
                const typeOrder = {
                    class: 0,
                    function: 1,
                    interface: 2,
                    type: 3,
                    const: 4,
                    enum: 5,
                };
                return (
                    (typeOrder[a.type as keyof typeof typeOrder] || 99) -
                    (typeOrder[b.type as keyof typeof typeOrder] || 99)
                );
            }
            return a.name.localeCompare(b.name);
        });

        for (const exp of sortedExports) {
            let line = `- **${exp.name}** (${exp.type})`;

            if (showTypes && exp.signature) {
                line += ` ${exp.signature}`;
            }

            if (exp.visibility === "private") {
                line += forTerminal ? " [private]" : " [private]";
            }

            lines.push(line);

            if (exp.docstring) {
                lines.push(`  ${exp.docstring}`);
            }

            lines.push("");
        }

        lines.push("");
    }

    return lines.join("\n");
}

function getTypeIcon(type: string, forTerminal: boolean = false): string {
    return "";
}

function getTypeColor(
    type: string,
    forTerminal: boolean = false,
): (text: string) => string {
    if (!forTerminal) {
        return (text: string) => text;
    }
    const colors: Record<string, (text: string) => string> = {
        class: chalk.magenta.bold,
        function: chalk.green,
        interface: chalk.blue,
        type: chalk.cyan,
        const: chalk.red,
        enum: chalk.blue,
        method: chalk.green,
        property: chalk.yellow,
    };
    return colors[type] || chalk.white;
}

async function handleOutput(
    content: string,
    options: TreeOptions,
    basePath: string,
): Promise<void> {
    const config = loadConfig();
    const defaultOutput = config.distiller?.defaultOutput || "save";

    if (options.clipboard) {
        await clipboardy.write(content);
        console.log(chalk.cyan("API tree copied to clipboard"));
    } else if (options.output) {
        await fs.writeFile(options.output, content, "utf-8");
        console.log(
            chalk.cyan("💾 API tree written to: ") +
                chalk.green(options.output),
        );
    } else if (options.stdout || defaultOutput === "stdout") {
        console.log(content);
    } else if (defaultOutput === "clipboard") {
        await clipboardy.write(content);
        console.log(chalk.cyan("API tree copied to clipboard"));
    } else {
        // Default: save using OutputManager
        const outputManager = new OutputManager();
        const folderName = basename(basePath);

        await outputManager.saveOutput(content, {
            command: "tree",
            context: folderName,
            format: options.format === "json" ? "json" : "txt",
        });

        const fullPath = await outputManager.getFilePath({
            command: "tree",
            context: folderName,
            format: options.format === "json" ? "json" : "txt",
        });

        console.log(
            chalk.cyan("💾 API tree saved to: ") + chalk.green(fullPath),
        );
        console.log(chalk.dim(`\nFor agents: cat "${fullPath}"`));
    }
}
