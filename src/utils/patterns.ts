/**
 * Convert a glob-like pattern to a RegExp.
 * Supports:
 * - `*` => any sequence
 * - `?` => single character
 */
export function globPatternToRegExp(pattern: string): RegExp {
    let regexPattern = "";
    for (let i = 0; i < pattern.length; i++) {
        const char = pattern[i];
        if (char === "*") {
            regexPattern += ".*";
        } else if (char === "?") {
            regexPattern += ".";
        } else if (char && "^+${}()|[]\\.".includes(char)) {
            regexPattern += "\\" + char;
        } else {
            regexPattern += char;
        }
    }

    return new RegExp(`^${regexPattern}$`);
}

export function matchesGlobPattern(value: string, pattern: string): boolean {
    try {
        return globPatternToRegExp(pattern).test(value);
    } catch {
        return value.includes(pattern.replace(/\*/g, ""));
    }
}

export function matchesAnyPattern(value: string, patterns: string[]): boolean {
    return patterns.some((pattern) => matchesGlobPattern(value, pattern));
}
