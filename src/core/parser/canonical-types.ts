/**
 * Canonical types for intermediate representation (IR)
 * These types represent a normalized, language-agnostic view of code structure
 */

export interface CanonicalExport {
    name: string;
    type: 'function' | 'class' | 'interface' | 'const' | 'type' | 'enum' | 'variable';
    signature: string;
    members?: CanonicalMember[];
}

export interface CanonicalMember {
    name: string;
    type: 'property' | 'method';
    signature: string;
}

export interface CanonicalImport {
    source: string;
    specifiers: string[];
    isDefault?: boolean;
    isNamespace?: boolean;
}

export interface CanonicalAPI {
    file: string;
    imports: CanonicalImport[];
    exports: CanonicalExport[];
}

/**
 * Node types we extract for each language
 */
export const EXTRACTABLE_NODES = {
    typescript: [
        'class_declaration',
        'function_declaration',
        'function_signature',
        'interface_declaration',
        'type_alias_declaration',
        'enum_declaration',
        'lexical_declaration', // const/let
        'variable_declaration',
        'export_statement',
        'import_statement',
        'method_definition',
        'property_signature',
        'public_field_definition',
    ],
    javascript: [
        'class_declaration',
        'function_declaration',
        'lexical_declaration',
        'variable_declaration',
        'export_statement',
        'import_statement',
        'method_definition',
        'field_definition',
    ],
    python: [
        'class_definition',
        'function_definition',
        'decorated_definition',
        'import_statement',
        'import_from_statement',
    ],
    go: [
        'type_declaration',
        'type_spec',
        'function_declaration',
        'method_declaration',
        'import_declaration',
        'package_clause',
        'const_declaration',
        'var_declaration',
    ],
} as const;

/**
 * Language detection from file extension
 */
export const LANGUAGE_MAP: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    py: 'python',
    go: 'go',
    rs: 'rust',
    java: 'java',
    kt: 'kotlin',
    swift: 'swift',
    c: 'c',
    cpp: 'cpp',
    cc: 'cpp',
    cxx: 'cpp',
    h: 'c',
    hpp: 'cpp',
    cs: 'csharp',
    rb: 'ruby',
    php: 'php',
    lua: 'lua',
    r: 'r',
    m: 'objective-c',
    mm: 'objective-cpp',
    scala: 'scala',
    sh: 'bash',
    zsh: 'zsh',
    fish: 'fish',
    ps1: 'powershell',
    yaml: 'yaml',
    yml: 'yaml',
    json: 'json',
    xml: 'xml',
    html: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'sass',
    less: 'less',
    sql: 'sql',
    graphql: 'graphql',
    gql: 'graphql',
    md: 'markdown',
    mdx: 'markdown',
};

export function detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    return ext ? (LANGUAGE_MAP[ext] || 'unknown') : 'unknown';
}