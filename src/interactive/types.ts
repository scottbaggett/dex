import type { GitChange } from "../types.js";

export interface FileItem extends GitChange {
    selected: boolean;
}

export interface InteractiveState {
    files: FileItem[];
    cursor: number;
    selectedCount: number;
    totalAdditions: number;
    totalDeletions: number;
    estimatedTokens: number;
}

export interface InteractiveModeProps {
    changes: GitChange[];
    onComplete: (selectedFiles: GitChange[], copyToClipboard?: boolean) => void;
    onCancel: () => void;
}
