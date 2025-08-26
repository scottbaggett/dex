/**
 * Language detection utilities
 */

const LANGUAGE_MAP: Record<string, string> = {
    // TypeScript/JavaScript
    ts: "typescript",
    tsx: "typescript", 
    js: "javascript",
    jsx: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    
    // Python
    py: "python",
    pyw: "python",
    
    // Go
    go: "go",
    
    // Rust
    rs: "rust",
    
    // Java/Kotlin
    java: "java",
    kt: "kotlin",
    kts: "kotlin",
    
    // C/C++
    c: "c",
    h: "c",
    cpp: "cpp",
    cc: "cpp",
    cxx: "cpp",
    hpp: "cpp",
    hxx: "cpp",
    
    // C#
    cs: "csharp",
    
    // Swift
    swift: "swift",
    
    // Ruby
    rb: "ruby",
    
    // PHP
    php: "php",
    
    // Other languages
    scala: "scala",
    r: "r",
    lua: "lua",
    dart: "dart",
    jl: "julia",
    ex: "elixir",
    exs: "elixir",
    clj: "clojure",
    cljs: "clojure",
    hs: "haskell",
    ml: "ocaml",
    fs: "fsharp",
    nim: "nim",
    v: "vlang",
    zig: "zig",
    
    // Shell
    sh: "bash",
    bash: "bash",
    zsh: "zsh",
    fish: "fish",
    ps1: "powershell",
    
    // Data/Config
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
    xml: "xml",
    
    // Web
    html: "html",
    htm: "html",
    css: "css",
    scss: "scss",
    sass: "sass",
    less: "less",
    
    // Other
    sql: "sql",
    graphql: "graphql",
    gql: "graphql",
    md: "markdown",
    mdx: "markdown",
};

/**
 * Detect language from file path
 */
export function detectLanguage(filePath: string): string | null {
    const ext = filePath.split(".").pop()?.toLowerCase();
    return ext ? (LANGUAGE_MAP[ext] || null) : null;
}

/**
 * Get all supported languages
 */
export function getSupportedLanguages(): string[] {
    return [...new Set(Object.values(LANGUAGE_MAP))].sort();
}

/**
 * Check if a language is supported
 */
export function isLanguageSupported(language: string): boolean {
    return Object.values(LANGUAGE_MAP).includes(language);
}

/**
 * Get file extensions for a language
 */
export function getExtensionsForLanguage(language: string): string[] {
    return Object.entries(LANGUAGE_MAP)
        .filter(([_, lang]) => lang === language)
        .map(([ext]) => ext);
}