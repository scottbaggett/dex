export interface PromptTemplate {
    id: string;
    name: string;
    description: string;
    instructions: string;
    examples?: PromptExample[];
    tags?: string[];
    llm?: string[]; // Recommended LLMs for this preset
    extends?: string; // Inherit from another preset
    variables?: Record<string, string>; // Template variables
}

export interface PromptExample {
    input: string;
    output: string;
    explanation?: string;
}

export interface PromptsConfig {
    prompts: Record<string, Omit<PromptTemplate, "id">>;
    defaults?: {
        prompt?: string;
        llm?: string;
    };
}
