export class CommandExitError extends Error {
    readonly exitCode: number;

    constructor(exitCode: number, message?: string) {
        super(message ?? `Command exited with code ${exitCode}`);
        this.name = "CommandExitError";
        this.exitCode = exitCode;
    }
}

export function isCommandExitError(error: unknown): error is CommandExitError {
    return error instanceof CommandExitError;
}
