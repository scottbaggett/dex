import React, { useState, useEffect } from "react";
import { Box, Text, useApp, useInput } from "ink";
import TextInput from "ink-text-input";
import type { GitChange } from "../types.js";
import type { EnhancedGitChange } from "../utils/file-selector.js";
import path from "path";
import fs from "fs";

interface FileSelectorProps {
    changes: (GitChange | EnhancedGitChange)[];
    onComplete: (selectedFiles: GitChange[], copyToClipboard?: boolean) => void;
    onCancel: () => void;
}

type SortBy = "name" | "updated" | "size" | "status";
type FilterBy =
    | "all"
    | "staged"
    | "unstaged"
    | "untracked"
    | "modified"
    | "added"
    | "deleted";
type ViewMode = "files" | "sort" | "filter";

interface FileItem extends GitChange {
    selected: boolean;
    fileSize?: number;
    isStaged?: boolean;
    isUnstaged?: boolean;
    isUntracked?: boolean;
}

interface DisplayItem {
    path: string;
    isHeader?: boolean;
    fileCount?: number;
    selected: boolean;
    mixed?: boolean;
    files?: FileItem[];
    tokenEstimate?: number;
    // File properties (only for non-headers)
    status?: string;
    additions?: number;
    deletions?: number;
    lastModified?: Date | string;
    diff?: string;
    fileSize?: number;
    isStaged?: boolean;
    isUnstaged?: boolean;
    isUntracked?: boolean;
    file?: string;
}

// Get file type specific token multiplier
function getTokenMultiplier(filePath: string): number {
    const ext = path.extname(filePath).toLowerCase();
    const filename = path.basename(filePath).toLowerCase();

    // Check for minified files first
    if (filename.includes(".min.") && (ext === ".js" || ext === ".css")) {
        return 2.5; // ~2.5 characters per token
    }

    // Different file types have different token densities
    switch (ext) {
        // Code files - moderately dense
        case ".js":
        case ".ts":
        case ".jsx":
        case ".tsx":
        case ".py":
        case ".java":
        case ".cpp":
        case ".c":
        case ".cs":
        case ".go":
        case ".rs":
        case ".php":
        case ".rb":
            return 3.5; // ~3.5 characters per token

        // Markup/config files - less dense due to structure
        case ".html":
        case ".xml":
        case ".json":
        case ".yaml":
        case ".yml":
        case ".toml":
            return 4.5; // ~4.5 characters per token

        // Documentation/text files - least dense
        case ".md":
        case ".txt":
        case ".rst":
            return 5.0; // ~5 characters per token

        // CSS - structure dependent
        case ".css":
        case ".scss":
        case ".sass":
        case ".less":
            return 4.0; // ~4 characters per token

        // Default for unknown types
        default:
            return 4.0; // Conservative estimate
    }
}

// Smart path truncation: keeps filename and shows partial path
function truncatePath(path: string, maxLength: number): string {
    if (path.length <= maxLength) return path;

    const parts = path.split("/");
    const filename = parts[parts.length - 1];

    if (!filename) {
        return path.length > maxLength
            ? path.substring(0, maxLength - 3) + "..."
            : path;
    }

    if (filename.length > maxLength - 3) {
        return filename.substring(0, Math.max(10, maxLength - 6)) + "...";
    }

    if (maxLength < 20) {
        return filename.length > maxLength - 3
            ? filename.substring(0, maxLength - 3) + "..."
            : filename;
    }

    let result = filename;
    let i = parts.length - 2;

    while (
        i >= 0 &&
        parts[i] &&
        result.length + (parts[i]?.length || 0) + 4 < maxLength
    ) {
        result = parts[i] + "/" + result;
        i--;
    }

    if (i >= 0) {
        const remainingSpace = maxLength - result.length - 4;
        if (
            remainingSpace > 0 &&
            parts[i] &&
            parts[i]!.length <= remainingSpace
        ) {
            result = ".../" + parts[i] + "/" + result;
        } else {
            result = ".../" + result;
        }
    }

    return result;
}

// Format token count for display
function formatTokens(tokens: number): string {
    if (tokens >= 1000) {
        return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toString();
}

// Calculate token estimate for a single file
async function calculateFileTokens(file: GitChange): Promise<number> {
    // If we have git diff data, use it
    if (file.additions > 0 || file.deletions > 0) {
        return Math.ceil(((file.additions + file.deletions) * 80) / 4);
    }

    // For flat file selection, estimate based on file content
    try {
        const filePath = path.resolve(file.file);
        const stats = await fs.promises.stat(filePath);
        const multiplier = getTokenMultiplier(file.file);
        return Math.ceil(stats.size / multiplier);
    } catch (error) {
        console.error(error);
        // If we can't read the file, make a conservative estimate based on file type
        const multiplier = getTokenMultiplier(file.file);
        return Math.ceil(1000 / multiplier); // Assume ~1KB file
    }
}

// Format relative time
function formatRelativeTime(date: Date | string | undefined): string {
    if (!date) return "        ";

    const dateObj = typeof date === "string" ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return "        ";

    const now = new Date();
    const diff = now.getTime() - dateObj.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "just now";
}

// Format file size to human-readable string
function formatFileSize(bytes: number): string {
    if (!bytes || bytes === 0) return "0B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const sizeLabel = sizes[i] || "B"; // Default to "B" if i is out of bounds

    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizeLabel;
}

const FileSelector: React.FC<FileSelectorProps> = ({
    changes,
    onComplete,
    onCancel,
}) => {
    const { exit } = useApp();
    const [terminalSize, setTerminalSize] = useState({
        rows: process.stdout.rows || 24,
        columns: process.stdout.columns || 80,
    });

    // Group files by directory and create display items
    const [displayItems, setDisplayItems] = useState<DisplayItem[]>([]);
    const [tokenEstimates, setTokenEstimates] = useState<Map<string, number>>(
        new Map(),
    );

    // Sorting and filtering state
    const [viewMode, setViewMode] = useState<ViewMode>("files");
    const [sortBy, setSortBy] = useState<SortBy>("name");
    const [filterBy, setFilterBy] = useState<FilterBy>("all");
    const [menuCursor, setMenuCursor] = useState(0);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [isSearching, setIsSearching] = useState(false);

    // Apply sorting to files
    const applySorting = (files: FileItem[], sort: SortBy): FileItem[] => {
        return [...files].sort((a, b) => {
            switch (sort) {
                case "name":
                    return a.file.localeCompare(b.file);
                case "updated":
                    if (a.lastModified && b.lastModified) {
                        return (
                            b.lastModified.getTime() - a.lastModified.getTime()
                        );
                    }
                    return 0;
                case "size":
                    return (b.fileSize || 0) - (a.fileSize || 0);
                case "status":
                    return a.status.localeCompare(b.status);
                default:
                    return 0;
            }
        });
    };

    // Calculate directory metrics for sorting
    const getDirectoryMetrics = (dirFiles: FileItem[]) => {
        const totalSize = dirFiles.reduce(
            (sum, f) => sum + (tokenEstimates.get(f.file) || 0),
            0,
        );
        const latestModified = dirFiles.reduce(
            (latest, f) => {
                if (!f.lastModified) return latest;
                if (!latest) return f.lastModified;
                return f.lastModified > latest ? f.lastModified : latest;
            },
            null as Date | null,
        );
        const primaryStatus = dirFiles[0]?.status || "modified";
        return { totalSize, latestModified, primaryStatus };
    };

    // Apply filtering to files
    const applyFiltering = (
        files: FileItem[],
        filter: FilterBy,
    ): FileItem[] => {
        if (filter === "all") return files;

        return files.filter((file) => {
            // Check if this is an enhanced change with staging info
            const enhanced = file as EnhancedGitChange;

            switch (filter) {
                case "staged":
                    return enhanced.isStaged === true;
                case "unstaged":
                    return enhanced.isUnstaged === true;
                case "untracked":
                    return enhanced.isUntracked === true;
                case "modified":
                    return file.status === "modified";
                case "added":
                    return file.status === "added";
                case "deleted":
                    return file.status === "deleted";
                default:
                    return true;
            }
        });
    };

    // Fuzzy search function
    const fuzzyMatch = (str: string, pattern: string): boolean => {
        if (!pattern) return true;
        pattern = pattern.toLowerCase();
        str = str.toLowerCase();
        
        let patternIdx = 0;
        let strIdx = 0;
        const patternLength = pattern.length;
        const strLength = str.length;
        
        while (patternIdx < patternLength && strIdx < strLength) {
            if (pattern[patternIdx] === str[strIdx]) {
                patternIdx++;
            }
            strIdx++;
        }
        
        return patternIdx === patternLength;
    };

    // Apply search filtering
    const applySearchFilter = (
        files: FileItem[],
        query: string,
    ): FileItem[] => {
        if (!query) return files;
        
        return files.filter((file) => {
            // Search in file path and filename
            const fileName = path.basename(file.file);
            const fullPath = file.file;
            
            // Check for exact substring match first (faster)
            if (fullPath.toLowerCase().includes(query.toLowerCase())) {
                return true;
            }
            
            // Then try fuzzy match
            return fuzzyMatch(fullPath, query) || fuzzyMatch(fileName, query);
        });
    };

    // Initialize display items and calculate token estimates
    useEffect(() => {
        const initializeItems = async () => {
            let files: FileItem[] = changes.map((change) => ({
                ...change,
                selected: false,
                fileSize: (change as unknown as FileItem).fileSize || 0,
                isStaged: (change as unknown as FileItem).isStaged || false,
                isUnstaged: (change as unknown as FileItem).isUnstaged || false,
                isUntracked: (change as unknown as FileItem).isUntracked || false,
            }));

            // Calculate token estimates for all files
            const estimates = new Map<string, number>();
            await Promise.all(
                files.map(async (file) => {
                    const tokens = await calculateFileTokens(file);
                    estimates.set(file.file, tokens);
                }),
            );
            setTokenEstimates(estimates);

            // Apply filtering, search, and sorting
            files = applyFiltering(files, filterBy);
            files = applySearchFilter(files, searchQuery);
            files = applySorting(files, sortBy);

            // Group files by directory
            const groupedFiles: Record<string, FileItem[]> = {};
            files.forEach((file) => {
                const dir = path.dirname(file.file);
                const normalizedDir = dir === "." ? "root" : dir;
                if (!groupedFiles[normalizedDir]) {
                    groupedFiles[normalizedDir] = [];
                }
                groupedFiles[normalizedDir].push(file);
            });

            // Create display items with headers
            const items: DisplayItem[] = [];

            // Sort directories based on current sort criteria
            const sortedDirs = Object.keys(groupedFiles).sort((a, b) => {
                const aFiles = groupedFiles[a];
                const bFiles = groupedFiles[b];
                const aMetrics = getDirectoryMetrics(aFiles || []);
                const bMetrics = getDirectoryMetrics(bFiles || []);

                switch (sortBy) {
                    case "name":
                        return a.localeCompare(b);
                    case "updated":
                        if (
                            aMetrics.latestModified &&
                            bMetrics.latestModified
                        ) {
                            return (
                                bMetrics.latestModified.getTime() -
                                aMetrics.latestModified.getTime()
                            );
                        }
                        return 0;
                    case "size":
                        return bMetrics.totalSize - aMetrics.totalSize;
                    case "status":
                        return aMetrics.primaryStatus.localeCompare(
                            bMetrics.primaryStatus,
                        );
                    default:
                        return a.localeCompare(b);
                }
            });

            for (const dir of sortedDirs) {
                const dirFiles = groupedFiles[dir];
                const allSelected = dirFiles?.every((f) => f.selected) || false;
                const someSelected = dirFiles?.some((f) => f.selected) || false;

                // Add directory header
                items.push({
                    path: dir === "root" ? "." : dir,
                    isHeader: true,
                    fileCount: dirFiles?.length || 0,
                    selected: allSelected,
                    mixed: someSelected && !allSelected,
                    files: dirFiles,
                });

                // Add files in this directory
                dirFiles?.forEach((file) => {
                    items.push({
                        ...file,
                        path: file.file,
                        selected: file.selected,
                        tokenEstimate: estimates.get(file.file) || 0,
                        fileSize: (file as unknown as FileItem).fileSize || 0,
                        isStaged: (file as unknown as FileItem).isStaged || false,
                        isUnstaged: (file as unknown as FileItem).isUnstaged || false,
                        isUntracked: (file as unknown as FileItem).isUntracked || false,
                    });
                });
            }

            setDisplayItems(items);
        };

        initializeItems();
    }, [changes, sortBy, filterBy, searchQuery]);

    const [cursor, setCursor] = useState(0);
    const [stats, setStats] = useState({
        selectedCount: 0,
        totalAdditions: 0,
        totalDeletions: 0,
        estimatedTokens: 0,
    });

    // Calculate stats when selection changes
    useEffect(() => {
        const calculateStats = async () => {
            const selectedFiles = displayItems.filter(
                (item) => !item.isHeader && item.selected,
            );
            const totalAdditions = selectedFiles.reduce(
                (sum, f) => sum + (f.additions || 0),
                0,
            );
            const totalDeletions = selectedFiles.reduce(
                (sum, f) => sum + (f.deletions || 0),
                0,
            );

            let estimatedTokens = 0;

            // If we have git diff data, use it
            if (totalAdditions > 0 || totalDeletions > 0) {
                estimatedTokens = Math.ceil(
                    ((totalAdditions + totalDeletions) * 80) / 4,
                );
            } else {
                // For flat file selection, estimate based on file content with type-specific multipliers
                estimatedTokens = await Promise.all(
                    selectedFiles.map(async (file) => {
                        try {
                            const filePath = path.resolve(file.path);
                            const stats = await fs.promises.stat(filePath);
                            const multiplier = getTokenMultiplier(file.path);
                            return Math.ceil(stats.size / multiplier);
                        } catch (error) {
                            console.error(error);
                            // If we can't read the file, make a conservative estimate based on file type
                            const multiplier = getTokenMultiplier(file.path);
                            return Math.ceil(1000 / multiplier); // Assume ~1KB file
                        }
                    }),
                ).then((tokens) => tokens.reduce((sum, t) => sum + t, 0));
            }

            setStats({
                selectedCount: selectedFiles.length,
                totalAdditions,
                totalDeletions,
                estimatedTokens,
            });
        };

        calculateStats();
    }, [displayItems]);

    // Handle terminal resize
    useEffect(() => {
        const handleResize = () => {
            const rows = Math.min(process.stdout.rows || 24, 30);
            const columns = Math.min(process.stdout.columns || 80, 120);
            setTerminalSize({ rows, columns });
        };

        handleResize();
        process.stdout.on("resize", handleResize);
        return () => {
            process.stdout.off("resize", handleResize);
        };
    }, []);

    // Update directory header states when files change
    const updateDirectoryStates = (items: DisplayItem[]) => {
        return items.map((item) => {
            if (item.isHeader && item.files) {
                const allSelected = item.files.every((f) => f.selected);
                const someSelected = item.files.some((f) => f.selected);
                // Calculate total tokens for files in this directory
                const totalTokens = item.files.reduce((sum, file) => {
                    const tokens = tokenEstimates.get(file.file) || 0;
                    return sum + tokens;
                }, 0);
                return {
                    ...item,
                    selected: allSelected,
                    mixed: someSelected && !allSelected,
                    tokenEstimate: totalTokens,
                };
            }
            return item;
        });
    };

    // Handle search input changes
    const handleSearchChange = (value: string) => {
        setSearchInput(value);
        setSearchQuery(value); // Update search query in real-time
    };

    // Handle search submit
    const handleSearchSubmit = () => {
        setIsSearching(false);
    };

    useInput((input, key) => {
        // Handle search mode when active
        if (isSearching) {
            if (key.escape) {
                setSearchInput("");
                setSearchQuery("");
                setIsSearching(false);
                return;
            }
            
            // Don't handle other inputs when searching, let TextInput handle them
            return;
        }
        
        // Handle menu navigation
        if (viewMode === "sort" || viewMode === "filter") {
            if (key.escape) {
                setViewMode("files");
                return;
            }

            if (key.upArrow || input === "k") {
                const maxOptions = viewMode === "sort" ? 4 : 7; // 4 sort options, 7 filter options
                setMenuCursor((prev) => (prev - 1 + maxOptions) % maxOptions);
                return;
            }

            if (key.downArrow || input === "j") {
                const maxOptions = viewMode === "sort" ? 4 : 7;
                setMenuCursor((prev) => (prev + 1) % maxOptions);
                return;
            }

            if (key.return) {
                if (viewMode === "sort") {
                    const sortOptions: SortBy[] = [
                        "name",
                        "updated",
                        "size",
                        "status",
                    ];
                    setSortBy(sortOptions[menuCursor] || "name");
                } else if (viewMode === "filter") {
                    const filterOptions: FilterBy[] = [
                        "all",
                        "staged",
                        "unstaged",
                        "untracked",
                        "modified",
                        "added",
                        "deleted",
                    ];
                    setFilterBy(filterOptions[menuCursor] || "all");
                }
                setViewMode("files");
                return;
            }

            return; // Don't process other keys in menu mode
        }

        // Regular file selection mode
        if (key.escape) {
            onCancel();
            exit();
            return;
        }

        if (key.return) {
            // Confirm selection
            const selectedFiles = displayItems
                .filter((item) => !item.isHeader && item.selected)
                .map((item) => {
                    const {
                        ...change
                    } = item;
                    return change as GitChange;
                });
            onComplete(selectedFiles, false);
            exit();
            return;
        }

        if (input === "c" || input === "C") {
            // Copy to clipboard
            const selectedFiles = displayItems
                .filter((item) => !item.isHeader && item.selected)
                .map((item) => {
                    const {
                        ...change
                    } = item;
                    return change as GitChange;
                });
            onComplete(selectedFiles, true);
            exit();
            return;
        }

        if (key.upArrow || input === "k" || input === "K") {
            setCursor((prev) => Math.max(0, prev - 1));
            return;
        }

        if (key.downArrow || input === "j" || input === "J") {
            setCursor((prev) => Math.min(displayItems.length - 1, prev + 1));
            return;
        }

        if (key.tab && !key.shift) {
            // Jump to next directory
            const headerIndices = displayItems
                .map((item, index) => (item.isHeader ? index : -1))
                .filter((index) => index !== -1);

            const currentHeaderIndex = headerIndices.findIndex(
                (index) => index > cursor,
            );
            if (currentHeaderIndex !== -1) {
                setCursor(headerIndices[currentHeaderIndex] || 0);
            } else if (headerIndices.length > 0) {
                // Wrap to first directory
                setCursor(headerIndices[0] || 0);
            }
            return;
        }

        if (key.tab && key.shift) {
            // Jump to previous directory
            const headerIndices = displayItems
                .map((item, index) => (item.isHeader ? index : -1))
                .filter((index) => index !== -1);

            const reversedIndices = [...headerIndices].reverse();
            const currentHeaderIndex = reversedIndices.findIndex(
                (index) => index < cursor,
            );
            if (currentHeaderIndex !== -1) {
                setCursor(reversedIndices[currentHeaderIndex] || 0);
            } else if (headerIndices.length > 0) {
                // Wrap to last directory
                setCursor(headerIndices[headerIndices.length - 1] || 0);
            }
            return;
        }

        if (input === " ") {
            const currentItem = displayItems[cursor];

            if (currentItem?.isHeader) {
                // Find all files in this directory from current displayItems
                const directoryPath =
                    currentItem.path === "." ? "root" : currentItem.path || "";
                const filesInDirectory = displayItems.filter(
                    (item) =>
                        !item.isHeader &&
                        (path.dirname(item.path) === directoryPath ||
                            (directoryPath === "root" &&
                                path.dirname(item.path) === ".")),
                );

                // Toggle all files in directory based on current selection state
                const allSelected = filesInDirectory.every((f) => f.selected);
                const newSelection = !allSelected;

                setDisplayItems((prev) => {
                    const updated = prev.map((item) => {
                        if (item.isHeader) return item;
                        // Check if this file belongs to the current directory
                        const itemDir = path.dirname(item.path);
                        const normalizedItemDir =
                            itemDir === "." ? "root" : itemDir;
                        if (normalizedItemDir === directoryPath) {
                            return { ...item, selected: newSelection };
                        }
                        return item;
                    });
                    return updateDirectoryStates(updated);
                });
            } else if (!currentItem?.isHeader) {
                // Toggle single file
                setDisplayItems((prev) => {
                    const updated = prev.map((item, index) => {
                        if (index === cursor) {
                            return { ...item, selected: !item.selected };
                        }
                        return item;
                    });
                    return updateDirectoryStates(updated);
                });
            }
            return;
        }

        if (input === "a" || input === "A") {
            setDisplayItems((prev) => {
                const updated = prev.map((item) => ({
                    ...item,
                    selected: true,
                }));
                return updateDirectoryStates(updated);
            });
            return;
        }

        if (input === "n" || input === "N") {
            setDisplayItems((prev) => {
                const updated = prev.map((item) => ({
                    ...item,
                    selected: false,
                }));
                return updateDirectoryStates(updated);
            });
            return;
        }

        // Sort menu
        if (input === "s" || input === "S") {
            setViewMode("sort");
            setMenuCursor(0);
            return;
        }

        // Filter menu
        if (input === "f" || input === "F") {
            setViewMode("filter");
            setMenuCursor(0);
            return;
        }
        
        // Search mode - using 'slash' key
        if (input === "/" && !isSearching) {
            setIsSearching(true);
            // Don't clear the search query if it exists
            setSearchInput(searchQuery);
            return;
        }
        
        // Clear search when in files view with active search
        if (searchQuery && (input === "x" || input === "X")) {
            setSearchQuery("");
            setSearchInput("");
            setIsSearching(false);
            return;
        }
    });

    return (
        <Box flexDirection="column" width="100%">
            {/* Show menu or file list based on mode */}
            {viewMode === "sort" ? (
                <Box flexDirection="column" paddingX={1} marginY={1}>
                    <Text color="yellow" bold>
                        Sort Files By:
                    </Text>
                    <Box marginTop={1} flexDirection="column">
                        {["name", "updated", "size", "status"].map(
                            (option, i) => (
                                <Box key={option}>
                                    <Text
                                        color={
                                            i === menuCursor ? "cyan" : "white"
                                        }
                                    >
                                        {i === menuCursor ? ">" : " "} {option}
                                        {sortBy === option && (
                                            <Text color="green"> ✓</Text>
                                        )}
                                    </Text>
                                </Box>
                            ),
                        )}
                    </Box>
                    <Box marginTop={1}>
                        <Text color="gray">
                            Press ENTER to select, ESC to cancel
                        </Text>
                    </Box>
                </Box>
            ) : viewMode === "filter" ? (
                <Box flexDirection="column" paddingX={1} marginY={1}>
                    <Text color="yellow" bold>
                        Filter Files:
                    </Text>
                    <Box marginTop={1} flexDirection="column">
                        {[
                            "all",
                            "staged",
                            "unstaged",
                            "untracked",
                            "modified",
                            "added",
                            "deleted",
                        ].map((option, i) => (
                            <Box key={option}>
                                <Text
                                    color={i === menuCursor ? "cyan" : "white"}
                                >
                                    {i === menuCursor ? ">" : " "} {option}
                                    {filterBy === option && (
                                        <Text color="green"> ✓</Text>
                                    )}
                                </Text>
                            </Box>
                        ))}
                    </Box>
                    <Box marginTop={1}>
                        <Text color="gray">
                            Press ENTER to select, ESC to cancel
                        </Text>
                    </Box>
                </Box>
            ) : (
                <>
                    {/* Show active search query if searching */}
                    {searchQuery ? (
                        <Box paddingX={1}>
                            <Text color="yellow">Searching: </Text>
                            <Text color="cyan">&quot;{searchQuery}&quot;</Text>
                            <Text color="gray"> (press X to clear)</Text>
                        </Box>
                    ) : null}
                    
                    {/* Instructions */}
                    <Box borderColor="white" borderStyle="single" paddingX={1}>
                        <Text color="cyan">DEX: Select Files</Text>
                    </Box>

                    {/* Column headers */}
                    <Box paddingX={1}>
                        <Text color="gray"> </Text>
                        <Text color="gray"> </Text>
                        <Text color="gray"> </Text>
                        <Text color="gray" bold>
                            {"  File Path".padEnd(
                                Math.min(
                                    45,
                                    Math.max(25, terminalSize.columns - 30),
                                ),
                            )}
                        </Text>
                        <Text color="gray" bold>
                            {" S "}
                        </Text>
                        <Text color="gray" bold>
                            {" +/- "}
                        </Text>
                        <Text color="gray" bold>
                            {" Size "}
                        </Text>
                        <Text color="gray" bold>
                            {" Last "}
                        </Text>
                        <Text color="gray" bold>
                            {" Tokens"}
                        </Text>
                    </Box>

                    {/* File list */}
                    <Box flexDirection="column" paddingX={1}>
                        {(() => {
                            // Calculate pagination
                            const headerHeight = 6;
                            const maxVisibleItems = Math.max(
                                5,
                                terminalSize.rows - headerHeight,
                            );
                            const startIndex = Math.max(
                                0,
                                Math.min(
                                    cursor - Math.floor(maxVisibleItems / 2),
                                    displayItems.length - maxVisibleItems,
                                ),
                            );
                            const endIndex = Math.min(
                                displayItems.length,
                                startIndex + maxVisibleItems,
                            );
                            const visibleItems = displayItems.slice(
                                startIndex,
                                endIndex,
                            );

                            return visibleItems.map((item, visibleIndex) => {
                                const actualIndex = startIndex + visibleIndex;
                                const isActive = actualIndex === cursor;

                                if (item.isHeader) {
                                    // Directory header
                                    const dirFiles = item.files || [];
                                    const dirMetrics =
                                        getDirectoryMetrics(dirFiles);
                                    const dirTokens = dirMetrics.totalSize;
                                    const dirTokenDisplay =
                                        formatTokens(dirTokens);

                                    // Calculate total size in bytes
                                    const totalSizeBytes = dirFiles.reduce(
                                        (sum, f) =>
                                            sum + ((f as unknown as FileItem).fileSize || 0),
                                        0,
                                    );
                                    const sizeDisplay =
                                        totalSizeBytes > 0
                                            ? formatFileSize(totalSizeBytes)
                                            : "";

                                    // Count file statuses
                                    const statusCounts = dirFiles.reduce(
                                        (acc, f) => {
                                            const enhanced = f as unknown as FileItem;
                                            if (enhanced.isStaged) acc.staged++;
                                            else if (enhanced.isUnstaged)
                                                acc.unstaged++;
                                            else if (enhanced.isUntracked)
                                                acc.untracked++;

                                            if (f.status === "added")
                                                acc.added++;
                                            else if (f.status === "modified")
                                                acc.modified++;
                                            else if (f.status === "deleted")
                                                acc.deleted++;

                                            return acc;
                                        },
                                        {
                                            staged: 0,
                                            unstaged: 0,
                                            untracked: 0,
                                            added: 0,
                                            modified: 0,
                                            deleted: 0,
                                        },
                                    );

                                    // Build status summary
                                    const statusParts = [];
                                    if (statusCounts.staged > 0)
                                        statusParts.push(
                                            `${statusCounts.staged}●`,
                                        );
                                    if (statusCounts.unstaged > 0)
                                        statusParts.push(
                                            `${statusCounts.unstaged}○`,
                                        );
                                    if (statusCounts.untracked > 0)
                                        statusParts.push(
                                            `${statusCounts.untracked}?`,
                                        );
                                    const statusSummary =
                                        statusParts.length > 0
                                            ? ` [${statusParts.join(" ")}]`
                                            : "";

                                    const headerText = `${item.path}/ (${item.fileCount} files${sizeDisplay ? ", " + sizeDisplay : ""}, ${dirTokenDisplay} tokens)${statusSummary}`;
                                    const selectionIcon = item.selected
                                        ? "[x]"
                                        : item.mixed
                                          ? "[■]"
                                          : "[□]";

                                    const headerColor =
                                        item.selected || item.mixed
                                            ? "green"
                                            : "white";

                                    return (
                                        <Box key={`header-${item.path}`}>
                                            <Text
                                                color={
                                                    isActive ? "cyan" : "white"
                                                }
                                            >
                                                {isActive ? ">" : " "}
                                            </Text>
                                            <Text color={headerColor}>
                                                {selectionIcon}
                                            </Text>
                                            <Text> </Text>
                                            <Text
                                                color={
                                                    isActive
                                                        ? "cyan"
                                                        : headerColor
                                                }
                                                bold
                                            >
                                                {headerText}
                                            </Text>
                                            <Text color="gray">
                                                {" "}
                                                ────── all
                                            </Text>
                                        </Box>
                                    );
                                } else {
                                    // File item
                                    const textColor = item.selected
                                        ? "green"
                                        : "white";
                                    const pathWidth = Math.min(
                                        45,
                                        Math.max(25, terminalSize.columns - 30),
                                    );
                                    const truncatedPath = truncatePath(
                                        item.path,
                                        pathWidth,
                                    );
                                    const timeAgo = formatRelativeTime(
                                        item.lastModified,
                                    );
                                    const statusChar = (
                                        item.status || "unknown"
                                    )
                                        .charAt(0)
                                        .toUpperCase();
                                    const statusColor =
                                        {
                                            A: "green",
                                            M: "yellow",
                                            D: "red",
                                            R: "blue",
                                        }[statusChar] || "gray";
                                    const additions = (
                                        item.additions || 0
                                    ).toString();
                                    const deletions = (
                                        item.deletions || 0
                                    ).toString();
                                    const tokens = item.tokenEstimate || 0;
                                    const tokenDisplay = formatTokens(tokens);

                                    // Calculate actual file size
                                    const fileSize = (item as unknown as FileItem).fileSize;
                                    const sizeDisplay = fileSize
                                        ? formatFileSize(fileSize)
                                        : "?";

                                    // Add status indicators
                                    let statusIndicator = "";
                                    const enhanced = item as unknown as FileItem;
                                    if (enhanced.isStaged)
                                        statusIndicator = "●";
                                    else if (enhanced.isUnstaged)
                                        statusIndicator = "○";
                                    else if (enhanced.isUntracked)
                                        statusIndicator = "?";

                                    return (
                                        <Box key={item.path}>
                                            <Text
                                                color={
                                                    isActive
                                                        ? "cyan"
                                                        : textColor
                                                }
                                            >
                                                {isActive ? ">" : " "}
                                            </Text>
                                            <Text
                                                color={
                                                    item.selected
                                                        ? "green"
                                                        : "gray"
                                                }
                                                bold={item.selected}
                                            >
                                                [{item.selected ? "✓" : " "}]
                                            </Text>
                                            <Text> </Text>
                                            <Text
                                                color={
                                                    isActive
                                                        ? item.selected
                                                            ? "green"
                                                            : "cyan"
                                                        : textColor
                                                }
                                                bold={item.selected}
                                            >
                                                {"  " +
                                                    truncatedPath.padEnd(
                                                        pathWidth,
                                                    )}
                                            </Text>
                                            <Text
                                                color={statusColor}
                                                bold
                                            >{`${statusIndicator}${statusChar} `}</Text>
                                            <Text color="green">{`+${additions.padStart(3)}`}</Text>
                                            <Text color="red">{`-${deletions.padStart(3)}`}</Text>
                                            <Text color="gray">{` ${sizeDisplay.padStart(6)}`}</Text>
                                            <Text color="gray">{` ${timeAgo.padStart(7)}`}</Text>
                                            <Text color="yellow">{` ${tokenDisplay.padStart(5)}t`}</Text>
                                        </Box>
                                    );
                                }
                            });
                        })()}
                    </Box>

                    {/* Status bar */}
                    <Box
                        marginTop={1}
                        borderStyle="single"
                        borderColor="gray"
                        paddingX={1}
                    >
                        <Text>
                            {`Selected: ${stats.selectedCount} files  ~${(stats.estimatedTokens / 1000).toFixed(1)}K tokens`}
                        </Text>
                        {displayItems.length > 10 && (
                            <Text color="gray">{` | ${cursor + 1}/${displayItems.length}`}</Text>
                        )}
                    </Box>
                </>
            )}

            {/* Search input line at bottom when searching */}
            {isSearching && (
                <Box paddingX={1} borderStyle="single" borderColor="yellow">
                    <Text color="yellow" bold>Search: </Text>
                    <TextInput 
                        value={searchInput}
                        onChange={handleSearchChange}
                        onSubmit={handleSearchSubmit}
                        placeholder=""
                    />
                    <Text color="gray">  (ESC to cancel, ENTER to close)</Text>
                </Box>
            )}
            
            {/* Help - simplified and contextual */}
            {!isSearching && (
                <Box paddingX={1} marginTop={1}>
                    {viewMode === "files" ? (
                        <Box>
                            <Text color="cyan">↑↓</Text>
                            <Text color="white"> move | </Text>
                            <Text color="cyan">␣</Text>
                            <Text color="white"> select | </Text>
                            <Text color="cyan">a/n</Text>
                            <Text color="white"> all/none | </Text>
                            <Text color="cyan">s</Text>
                            <Text color="white"> sort | </Text>
                            <Text color="cyan">f</Text>
                            <Text color="white"> filter | </Text>
                            <Text color="cyan">/</Text>
                            <Text color="white"> search | </Text>
                            <Text color="cyan">c</Text>
                            <Text color="white"> copy | </Text>
                            <Text color="cyan">⏎</Text>
                            <Text color="white"> confirm | </Text>
                            <Text color="cyan">ESC</Text>
                            <Text color="white"> cancel</Text>
                        </Box>
                ) : (
                    <Box>
                        <Text color="cyan">↑↓</Text>
                        <Text color="white"> select option | </Text>
                        <Text color="cyan">⏎</Text>
                        <Text color="white"> apply | </Text>
                        <Text color="cyan">ESC</Text>
                        <Text color="white"> back</Text>
                    </Box>
                )}
                </Box>
            )}
        </Box>
    );
};

export default FileSelector;
export { truncatePath, formatRelativeTime };
