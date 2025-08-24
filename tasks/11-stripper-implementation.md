# Task 11: Implement Code Stripper for Token Optimization

## Problem
Currently, dex extracts all code content without the ability to strip unnecessary elements. This leads to:
- Higher token usage when sending to AI models
- Exposure of private/internal implementation details
- Inclusion of noise (comments, implementations) when only signatures are needed

## Inspiration
The ai-distiller project has a robust stripper implementation in Go that selectively removes code elements based on visibility and type.

## Requirements
- Implement a Stripper class that can remove specified elements from extracted code
- Support visibility-based filtering (private, protected, internal)
- Support content-based filtering (implementations, comments, docstrings)
- Integrate with extract and distill commands via CLI options
- Maintain language-agnostic approach with language-specific handling

## Implementation Plan
1. Create `src/core/stripper/index.ts` with Stripper class
2. Define StripperOptions interface for configuration
3. Implement stripping logic for different element types
4. Add CLI options to extract and distill commands
5. Create preset configurations (forAI, forDocs, minimal)
6. Add comprehensive tests

## Acceptance Criteria
- [ ] Stripper class with configurable options
- [ ] Support for visibility-based removal (private, protected, internal)
- [ ] Support for content-based removal (implementations, comments, docstrings)
- [ ] Support for member-based removal (fields, methods, types, interfaces)
- [ ] Language-specific conventions (e.g., _ prefix for private in Python/JS)
- [ ] CLI integration with --strip options
- [ ] Preset configurations for common use cases
- [ ] Comprehensive test coverage
- [ ] Documentation and examples

## Files to Create/Modify
- `src/core/stripper/index.ts` - Main stripper implementation
- `src/core/stripper/types.ts` - TypeScript interfaces
- `src/commands/extract.ts` - Add --strip CLI options
- `src/commands/distill.ts` - Add --strip CLI options
- `test/stripper.test.ts` - Unit tests
- `docs/stripper.md` - Documentation

## CLI Options to Add

### Extract Command
```bash
# Basic stripping
dex extract --strip private          # Remove private members
dex extract --strip private,protected # Remove private and protected
dex extract --strip implementations  # Remove function bodies

# Preset configurations
dex extract --strip-preset ai        # Optimized for AI consumption
dex extract --strip-preset docs      # Public API documentation
dex extract --strip-preset minimal   # Signatures only

# Fine-grained control
dex extract --strip-private --strip-implementations --keep-docstrings
```

### Distill Command
```bash
# Same options for distill
dex distill ./src --strip private,implementations
dex distill ./src --strip-preset ai
```

## Detailed Implementation

### 1. StripperOptions Interface
```typescript
export interface StripperOptions {
    // Visibility-based removal
    removePrivate?: boolean;
    removeProtected?: boolean;
    removeInternal?: boolean;

    // Content-based removal
    removeImplementations?: boolean;
    removeComments?: boolean;
    removeDocstrings?: boolean;
    removeImports?: boolean;

    // Member-based removal
    removeFields?: boolean;
    removeMethods?: boolean;
    removeTypes?: boolean;
    removeInterfaces?: boolean;

    // Language-specific
    removeDecorators?: boolean;
    removeGenerics?: boolean;
}
```

### 2. Stripper Class Core Methods
```typescript
class Stripper {
    strip(api: ExtractedAPI): ExtractedAPI
    shouldRemoveByVisibility(item: ExtractedExport): boolean
    shouldRemoveByType(item: ExtractedExport): boolean
    stripImplementation(signature: string, type: string): string

    // Preset factories
    static forAI(): Stripper
    static forDocs(): Stripper
    static minimal(): Stripper
}
```

### 3. Language-Specific Implementation Removal

#### TypeScript/JavaScript
- Remove everything between `{` and `}` for functions
- Replace with `;` for declarations
- Handle arrow functions, async functions

#### Python
- Remove everything after `:` for functions/methods
- Replace with `: ...` or `: pass`
- Handle decorators appropriately

#### Go
- Remove function bodies between `{` and `}`
- Keep function signatures
- Handle receiver methods

#### Java/C#
- Remove method bodies
- Keep annotations/attributes based on options
- Handle access modifiers

### 4. Visibility Detection

#### Explicit Visibility
- Use visibility field from ExtractedExport
- Map language-specific keywords (public, private, protected, internal)

#### Convention-Based
- Python/JS: `_` prefix indicates private
- Go: lowercase first letter indicates package-private
- Java: no modifier means package-private

### 5. Integration with Context Engine

```typescript
// In ContextEngine.extract()
if (options.stripperOptions) {
    const stripper = new Stripper(options.stripperOptions);
    context.changes = context.changes.map(change => ({
        ...change,
        api: change.api ? stripper.strip(change.api) : undefined
    }));
}
```

## Test Cases

### Unit Tests
```typescript
describe("Stripper", () => {
    test("removes private members", () => {
        const api = {
            exports: [
                { name: "publicFunc", visibility: "public" },
                { name: "_privateFunc", visibility: "private" }
            ]
        };
        const stripped = new Stripper({ removePrivate: true }).strip(api);
        expect(stripped.exports).toHaveLength(1);
        expect(stripped.exports[0].name).toBe("publicFunc");
    });

    test("removes implementations", () => {
        const api = {
            exports: [{
                name: "calculate",
                signature: "function calculate(x: number): number { return x * 2; }"
            }]
        };
        const stripped = new Stripper({ removeImplementations: true }).strip(api);
        expect(stripped.exports[0].signature).toBe("function calculate(x: number): number;");
    });

    test("preset configurations", () => {
        const stripper = Stripper.forAI();
        expect(stripper.options.removePrivate).toBe(true);
        expect(stripper.options.removeImplementations).toBe(true);
        expect(stripper.options.removeDocstrings).toBe(false);
    });
});
```

### Integration Tests
```typescript
describe("Stripper Integration", () => {
    test("extract with stripping", async () => {
        // Run extract with --strip private
        // Verify private members removed from output
    });

    test("distill with stripping", async () => {
        // Run distill with --strip-preset ai
        // Verify appropriate elements removed
    });
});
```

## Performance Considerations
- Stripping should be done after extraction, not during parsing
- Use efficient regex patterns for implementation removal
- Cache compiled regex patterns for repeated use
- Consider streaming for large files

## Documentation Examples

### Example 1: AI Optimization
```bash
# Extract only public API signatures for AI consumption
dex extract --staged --strip-preset ai --format markdown

# Removes:
# - Private/protected members
# - Implementation details
# - Regular comments
# Keeps:
# - Public signatures
# - Docstrings for context
# - Type information
```

### Example 2: Documentation Generation
```bash
# Generate public API documentation
dex distill ./src --strip-preset docs --format markdown

# Removes:
# - All non-public members
# - Implementation bodies
# - Internal comments
# Keeps:
# - Public API surface
# - Documentation comments
# - Type signatures
```

### Example 3: Custom Stripping
```bash
# Fine-grained control
dex extract --strip private --strip implementations --keep-docstrings

# Remove specific member types
dex extract --strip-fields --strip-types --keep-methods
```

## Success Metrics
- 30-70% reduction in token count for typical codebases
- No loss of essential API information
- Fast processing (<100ms overhead for stripping)
- Language-agnostic with language-specific optimizations
- Easy to extend for new languages

## Future Enhancements
1. Smart stripping based on relevance/importance
2. Context-aware stripping (keep related private methods)
3. Configurable presets via .dexrc
4. Integration with AI models for optimal stripping
5. Stripping statistics and reports
