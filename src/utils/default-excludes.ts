/**
 * Default exclude patterns for file operations
 */

export const DEFAULT_EXCLUDES = {
    // Version control (recursive)
    git: ["**/.git/**"],
    
    // Dependencies (recursive - matches in any subdirectory)
    dependencies: ["**/node_modules/**", "**/vendor/**", "**/bower_components/**"],
    
    // Build outputs (recursive for submodules/monorepos)
    build: ["**/dist/**", "**/build/**", "**/out/**", "**/.next/**", "**/.nuxt/**"],
    
    // Testing and coverage (recursive)
    testing: ["**/coverage/**", "**/.nyc_output/**"],
    testFiles: ["**/*.spec.ts", "**/*.spec.js", "**/*.test.ts", "**/*.test.js", "**/*.test.tsx", "**/*.test.jsx"],
    
    // Logs and temp files  
    logs: ["*.log", "logs/**", "*.tmp", "tmp/**", "temp/**"],
    
    // OS files
    system: [".DS_Store", "thumbs.db", "desktop.ini"],
    
    // Lock files
    lockFiles: ["*.lock", "package-lock.json", "yarn.lock", "pnpm-lock.yaml"],
    
    // Environment files
    env: [".env*", "!.env.example"],
    
    // Minified files
    minified: ["*.min.js", "*.min.css"],
    
    // Source maps
    sourceMaps: ["*.map"],
    
    // Images
    images: [
        "*.jpg", "*.jpeg", "*.png", "*.gif", "*.ico", "*.svg",
        "*.bmp", "*.tiff", "*.webp", "*.avif", "*.heic", "*.heif",
    ],
    
    // Audio/Video
    media: [
        "*.mp3", "*.mp4", "*.avi", "*.mov", "*.wmv", "*.flv",
        "*.webm", "*.mkv", "*.wav", "*.flac", "*.aac", "*.ogg",
        "*.m4a", "*.m4v", "*.mpg", "*.mpeg",
    ],
    
    // Documents
    documents: ["*.pdf", "*.doc", "*.docx", "*.xls", "*.xlsx", "*.ppt", "*.pptx"],
    
    // Archives
    archives: ["*.zip", "*.tar", "*.gz", "*.rar", "*.7z", "*.bz2", "*.xz", "*.jar", "*.war"],
    
    // Binary/Compiled files
    binaries: [
        "*.exe", "*.dll", "*.so", "*.dylib", "*.lib", "*.a",
        "*.o", "*.obj", "*.class", "*.pyc", "*.pyo",
        "*.beam", "*.elc", "*.wasm",
    ],
    
    // Python (recursive)
    python: ["**/__pycache__/**", "**/.pytest_cache/**", "**/.mypy_cache/**", "*.pyc", "*.pyo"],
    
    // Java/Kotlin (recursive)
    java: ["**/target/**", "*.class", "**/.gradle/**", "**/gradle/**"],
    
    // .NET (recursive)
    dotnet: ["**/bin/**", "**/obj/**", "*.dll", "*.exe", "*.pdb"],
    
    // Rust (recursive)
    rust: ["**/target/**", "*.rlib"],
    
    // Go
    go: ["*.test", "*.out"],
    
    // Cache directories (recursive)
    cache: ["**/.cache/**", "**/.parcel-cache/**", "**/.turbo/**", "**/.nx/**"],
    
    // IDE/Editor (recursive)
    ide: ["**/.idea/**", "**/.vscode/**", "*.swp", "*.swo", "*~", ".project", ".classpath"],
    
    // Dex specific (recursive)
    dex: ["**/.dex/**", "**/.opencode/**", "**/.workarea/**"],
};

/**
 * Get default excludes for different contexts
 */
export function getDefaultExcludes(options: {
    includeTestFiles?: boolean;
    includeMinified?: boolean;
    includeLockFiles?: boolean;
    includeSourceMaps?: boolean;
    includeImages?: boolean;
    includeMedia?: boolean;
    includeBinaries?: boolean;
} = {}): string[] {
    const excludes = [
        ...DEFAULT_EXCLUDES.git,
        ...DEFAULT_EXCLUDES.dependencies,
        ...DEFAULT_EXCLUDES.build,
        ...DEFAULT_EXCLUDES.testing,
        ...DEFAULT_EXCLUDES.logs,
        ...DEFAULT_EXCLUDES.system,
        ...DEFAULT_EXCLUDES.env,
        ...DEFAULT_EXCLUDES.dex,
        ...DEFAULT_EXCLUDES.python,
        ...DEFAULT_EXCLUDES.java,
        ...DEFAULT_EXCLUDES.dotnet,
        ...DEFAULT_EXCLUDES.rust,
        ...DEFAULT_EXCLUDES.go,
        ...DEFAULT_EXCLUDES.cache,
        ...DEFAULT_EXCLUDES.ide,
        ...DEFAULT_EXCLUDES.documents,
        ...DEFAULT_EXCLUDES.archives,
    ];
    
    // Always exclude binaries, images and media by default unless explicitly included
    if (!options.includeBinaries) {
        excludes.push(...DEFAULT_EXCLUDES.binaries);
    }
    
    if (!options.includeImages) {
        excludes.push(...DEFAULT_EXCLUDES.images);
    }
    
    if (!options.includeMedia) {
        excludes.push(...DEFAULT_EXCLUDES.media);
    }
    
    // Conditionally add based on options
    if (!options.includeTestFiles) {
        excludes.push(...DEFAULT_EXCLUDES.testFiles);
    }
    
    if (!options.includeMinified) {
        excludes.push(...DEFAULT_EXCLUDES.minified);
    }
    
    if (!options.includeLockFiles) {
        excludes.push(...DEFAULT_EXCLUDES.lockFiles);
    }
    
    if (!options.includeSourceMaps) {
        excludes.push(...DEFAULT_EXCLUDES.sourceMaps);
    }
    
    return excludes;
}

/**
 * Get default excludes for distill command
 * (excludes test files by default unless explicitly included)
 */
export function getDistillExcludes(options: { includeTestFiles?: boolean } = {}): string[] {
    return getDefaultExcludes({
        includeTestFiles: options.includeTestFiles || false,
        includeMinified: false,
        includeLockFiles: false,
        includeSourceMaps: false,
        includeImages: false,
        includeMedia: false,
        includeBinaries: false,
    });
}

/**
 * Get default excludes for combine command
 * (includes test files for context, but excludes binaries/media)
 */
export function getCombineExcludes(): string[] {
    return getDefaultExcludes({
        includeTestFiles: true, // Include tests for context
        includeMinified: false,
        includeLockFiles: false,
        includeSourceMaps: false,
        includeImages: false,
        includeMedia: false,
        includeBinaries: false,
    });
}