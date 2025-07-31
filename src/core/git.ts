import simpleGit, { type SimpleGit } from "simple-git";
import { type GitChange } from "../types";
import { promises as fs } from "fs";
import { join } from "path";

export class GitExtractor {
    private git: SimpleGit;
    private workingDir: string;
    private gitRoot: string | null = null;

    constructor(workingDir: string = process.cwd()) {
        this.workingDir = workingDir;
        this.git = simpleGit(workingDir);
    }

    private async getGitRoot(): Promise<string> {
        if (this.gitRoot) return this.gitRoot;

        try {
            const root = await this.git.revparse(["--show-toplevel"]);
            this.gitRoot = root.trim();
            return this.gitRoot;
        } catch {
            // Not in a git repository
            this.gitRoot = this.workingDir;
            return this.gitRoot;
        }
    }

    async getCurrentChanges(staged: boolean = false): Promise<GitChange[]> {
        const args = staged ? ["--cached"] : [];
        const diff = await this.git.diff(args);
        const changes = this.parseDiff(diff);
        return this.addFileModificationTimes(changes);
    }

    async getChangesSince(base: string): Promise<GitChange[]> {
        const diff = await this.git.diff([`${base}...HEAD`]);
        const changes = this.parseDiff(diff);
        return this.addFileModificationTimes(changes);
    }

    async getChangesInRange(from: string, to: string): Promise<GitChange[]> {
        const diff = await this.git.diff([`${from}..${to}`]);
        const changes = this.parseDiff(diff);
        return this.addFileModificationTimes(changes);
    }

    async getFileContent(path: string): Promise<string> {
        try {
            return await this.git.show([`HEAD:${path}`]);
        } catch {
            // File might be new, read from filesystem
            const fs = await import("fs/promises");
            const gitRoot = await this.getGitRoot();
            return await fs.readFile(join(gitRoot, path), "utf-8");
        }
    }

    async getUntrackedFiles(): Promise<string[]> {
        const result = await this.git.raw([
            "ls-files",
            "--others",
            "--exclude-standard",
        ]);
        return result.trim().split("\n").filter(Boolean);
    }

    private parseDiff(diffOutput: string): GitChange[] {
        if (!diffOutput) return [];

        const changes: GitChange[] = [];
        const fileDiffs = diffOutput.split(/^diff --git/m).slice(1);

        for (const fileDiff of fileDiffs) {
            const lines = fileDiff.split("\n");
            if (lines.length === 0) continue;
            const fileMatch = lines[0].match(/a\/(.*) b\/(.*)/);
            if (!fileMatch) continue;

            const [, oldPath, newPath] = fileMatch;

            let status: GitChange["status"] = "modified";
            if (lines.some((l) => l.startsWith("new file mode"))) {
                status = "added";
            } else if (lines.some((l) => l.startsWith("deleted file mode"))) {
                status = "deleted";
            } else if (lines.some((l) => l.startsWith("rename from"))) {
                status = "renamed";
            }

            let additions = 0;
            let deletions = 0;
            const diffContent: string[] = [];

            for (const line of lines) {
                if (line.startsWith("+") && !line.startsWith("+++")) {
                    additions++;
                    diffContent.push(line);
                } else if (line.startsWith("-") && !line.startsWith("---")) {
                    deletions++;
                    diffContent.push(line);
                } else if (line.startsWith("@@")) {
                    diffContent.push(line);
                } else if (line.startsWith(" ")) {
                    diffContent.push(line);
                }
            }

            changes.push({
                file: newPath,
                status,
                additions,
                deletions,
                diff: diffContent.join("\n"),
                oldFile: status === "renamed" ? oldPath : undefined,
            });
        }

        return changes;
    }

    async isGitRepository(): Promise<boolean> {
        try {
            await this.git.status();
            return true;
        } catch {
            return false;
        }
    }

    async getCurrentBranch(): Promise<string> {
        const branches = await this.git.branch();
        return branches.current;
    }

    async getLatestCommit(): Promise<string> {
        const log = await this.git.log({ n: 1 });
        return log.latest?.hash.substring(0, 7) || "unknown";
    }

    async getRepositoryRoot(): Promise<string> {
        return this.getGitRoot();
    }

    async getRepositoryName(): Promise<string> {
        try {
            const remotes = await this.git.getRemotes(true);
            if (remotes.length > 0 && remotes[0].refs.fetch) {
                const url = remotes[0].refs.fetch;
                // Extract repo name from URL (e.g., git@github.com:user/repo.git)
                const match = url.match(/([^/]+)\.git$/);
                if (match) {
                    return match[1];
                }
            }
        } catch {
            // Fallback to directory name
        }

        const path = await import("path");
        return path.basename(process.cwd());
    }

    async getTrackedFiles(): Promise<string[]> {
        const result = await this.git.raw(["ls-files"]);
        return result.trim().split("\n").filter(Boolean);
    }

    async getFileContentFromHead(path: string): Promise<string> {
        try {
            return await this.git.show([`HEAD:${path}`]);
        } catch {
            // File might not exist in HEAD (new file)
            return "";
        }
    }

    /**
     * Check if current branch is a feature branch (not main/master/develop)
     */
    async isFeatureBranch(): Promise<boolean> {
        const currentBranch = await this.getCurrentBranch();
        const mainBranches = ["main", "master", "develop", "dev"];
        return !mainBranches.includes(currentBranch);
    }

    /**
     * Find the main branch (main, master, or develop)
     */
    async findMainBranch(): Promise<string | null> {
        try {
            const branches = await this.git.branch(["-a"]);
            const branchNames = branches.all.map((b) =>
                b.replace(/^origin\//, ""),
            );

            // Check in order of preference
            const mainBranches = ["main", "master", "develop"];
            for (const mainBranch of mainBranches) {
                if (branchNames.includes(mainBranch)) {
                    return mainBranch;
                }
            }
            return null;
        } catch {
            return null;
        }
    }

    /**
     * Get merge-base between current branch and main branch
     */
    async getMergeBase(baseBranch?: string): Promise<string | null> {
        try {
            const currentBranch = await this.getCurrentBranch();
            const mainBranch = baseBranch || (await this.findMainBranch());

            if (!mainBranch || currentBranch === mainBranch) {
                return null;
            }

            const mergeBase = await this.git.raw([
                "merge-base",
                mainBranch,
                "HEAD",
            ]);
            return mergeBase.trim();
        } catch {
            return null;
        }
    }

    /**
     * Get changes since merge-base with main branch
     */
    async getFeatureBranchChanges(baseBranch?: string): Promise<GitChange[]> {
        const mergeBase = await this.getMergeBase(baseBranch);
        if (!mergeBase) {
            throw new Error(
                "Could not determine merge-base for feature branch",
            );
        }

        const diff = await this.git.diff([`${mergeBase}...HEAD`]);
        const changes = this.parseDiff(diff);
        return this.addFileModificationTimes(changes);
    }

    /**
     * Check if there are staged changes
     */
    async hasStagedChanges(): Promise<boolean> {
        const status = await this.git.status();
        return status.staged.length > 0;
    }

    /**
     * Check if there are unstaged changes
     */
    async hasUnstagedChanges(): Promise<boolean> {
        const status = await this.git.status();
        return status.modified.length > 0 || status.not_added.length > 0;
    }

    private async addFileModificationTimes(
        changes: GitChange[],
    ): Promise<GitChange[]> {
        const gitRoot = await this.getGitRoot();
        const changesWithTimes = await Promise.all(
            changes.map(async (change) => {
                try {
                    // Git paths are relative to the repository root
                    const filePath = join(gitRoot, change.file);
                    const stats = await fs.stat(filePath);
                    return {
                        ...change,
                        lastModified: stats.mtime,
                    };
                } catch (error) {
                    // File might have been deleted or doesn't exist
                    if (process.env.DEBUG) {
                        console.warn(
                            `Failed to get stats for ${change.file}:`,
                            error,
                        );
                    }
                    return change;
                }
            }),
        );
        return changesWithTimes;
    }
}
