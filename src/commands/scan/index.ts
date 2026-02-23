import { Command, Option } from "commander";
import chalk from "chalk";
import { readFileSync } from "fs";
import { resolve, relative } from "path";
import { z } from "zod";
import { FileSelector } from "../../utils/file-selector.js";
import { SensitiveDataScanner } from "../../core/safety/scanner.js";
import { CommandExitError } from "../../utils/command-exit.js";

const ScanFormatSchema = z.enum(["txt", "json"]);

const ScanOptionsSchema = z.object({
    format: ScanFormatSchema.default("txt"),
});

type ScanOptions = z.infer<typeof ScanOptionsSchema>;

interface ScanOutput {
    scannedFiles: number;
    findingsCount: number;
    countsByCategory: {
        credential: number;
        private_key: number;
        secret_assignment: number;
        email: number;
        phone: number;
        ssn: number;
    };
    findings: Array<{
        category: string;
        severity: string;
        filePath?: string;
        line?: number;
        detector: string;
    }>;
}

export function createScanCommand(): Command {
    const command = new Command("scan");

    command
        .description("Scan files for secrets and obvious PII without generating context output")
        .argument("[path]", "Path to scan", ".")
        .addOption(
            new Option("-f, --format <format>", "Output format")
                .choices(["txt", "json"])
                .default("txt"),
        )
        .action(async (targetPath: string, rawOptions: ScanOptions) => {
            await executeScan(targetPath, rawOptions);
        });

    return command;
}

async function executeScan(
    targetPath: string,
    rawOptions: ScanOptions,
): Promise<void> {
    const options = ScanOptionsSchema.parse(rawOptions);
    const resolvedPath = resolve(targetPath);

    const fileSelector = new FileSelector();
    const { files, errors } = await fileSelector.collectFiles([resolvedPath], {
        maxFiles: 10000,
        maxDepth: 30,
        respectGitignore: true,
    });

    if (errors.length > 0 && process.env.DEBUG) {
        for (const error of errors) {
            console.warn(chalk.yellow(error));
        }
    }

    if (files.length === 0) {
        throw new CommandExitError(1);
    }

    const scanner = new SensitiveDataScanner();
    const scannableFiles: Array<{ path: string; content: string }> = [];
    for (const filePath of files) {
        try {
            scannableFiles.push({
                path: relative(process.cwd(), filePath),
                content: readFileSync(filePath, "utf-8"),
            });
        } catch {
            // Skip unreadable files while continuing the scan.
        }
    }

    if (scannableFiles.length === 0) {
        throw new CommandExitError(1);
    }

    const scan = scanner.scanFiles(scannableFiles);
    const output: ScanOutput = {
        scannedFiles: scannableFiles.length,
        findingsCount: scan.findings.length,
        countsByCategory: scan.countsByCategory,
        findings: scan.findings.map((finding) => ({
            category: finding.category,
            severity: finding.severity,
            filePath: finding.filePath,
            line: finding.line,
            detector: finding.detector,
        })),
    };

    if (options.format === "json") {
        console.log(JSON.stringify(output, null, 2));
        return;
    }

    console.log(chalk.cyan("Dex Safety Scan"));
    console.log(chalk.white(`Scanned files: ${output.scannedFiles}`));
    console.log(chalk.white(`Findings: ${output.findingsCount}`));
    console.log(
        chalk.gray(
            `credential=${output.countsByCategory.credential}, private_key=${output.countsByCategory.private_key}, secret_assignment=${output.countsByCategory.secret_assignment}, email=${output.countsByCategory.email}, phone=${output.countsByCategory.phone}, ssn=${output.countsByCategory.ssn}`,
        ),
    );

    if (output.findings.length > 0) {
        console.log(chalk.yellow("\nTop findings:"));
        for (const finding of output.findings.slice(0, 10)) {
            const location = finding.filePath
                ? `${finding.filePath}${finding.line ? `:${finding.line}` : ""}`
                : "payload";
            console.log(
                `- [${finding.severity}] ${finding.category} via ${finding.detector} at ${location}`,
            );
        }
    }
}
