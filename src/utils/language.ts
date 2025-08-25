/**
 * Language utility functions
 */

/**
 * Maps file extensions to syntax highlighting language identifiers
 * Used for markdown code blocks and other formatted outputs
 */
export function getSyntaxLanguage(filePath: string): string {
    const ext = filePath.split(".").pop()?.toLowerCase();
    const langMap: Record<string, string> = {
        ts: "typescript",
        tsx: "typescript",
        js: "javascript",
        jsx: "javascript",
        py: "python",
        rb: "ruby",
        go: "go",
        rs: "rust",
        java: "java",
        cpp: "cpp",
        c: "c",
        cs: "csharp",
        php: "php",
        swift: "swift",
        kt: "kotlin",
        scala: "scala",
        sh: "bash",
        yaml: "yaml",
        yml: "yaml",
        json: "json",
        xml: "xml",
        html: "html",
        css: "css",
        scss: "scss",
        sql: "sql",
        md: "markdown",
        mdx: "markdown",
        vue: "vue",
        svelte: "svelte",
        lua: "lua",
        dart: "dart",
        r: "r",
        m: "matlab",
        jl: "julia",
        nim: "nim",
        zig: "zig",
        ex: "elixir",
        exs: "elixir",
        clj: "clojure",
        cljs: "clojure",
        ml: "ocaml",
        fs: "fsharp",
        fsx: "fsharp",
        pl: "perl",
        pm: "perl",
        hs: "haskell",
        elm: "elm",
        erl: "erlang",
        hrl: "erlang",
    };
    return langMap[ext || ""] || "text";
}