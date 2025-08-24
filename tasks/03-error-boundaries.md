# Task 03: Implement Error Boundaries

## Problem
No comprehensive error handling system. Current code uses basic try/catch with process.exit(1), exposing stack traces to users.

## Current State
- Basic try/catch blocks in commands
- Raw error messages shown to users
- Stack traces exposed on failures
- No recovery mechanisms
- Immediate process.exit on errors

## Requirements (P0 Charter)
- Clear recovery paths
- Never crash with raw stack traces
- Graceful degradation
- User-friendly error messages
- Error context and suggestions

## Implementation Plan
1. Create `ErrorBoundary` class in `src/core/errors/boundary.ts`
2. Define error types and categories
3. Implement error recovery strategies
4. Create user-friendly error formatter
5. Add error logging system
6. Wrap all commands with error boundaries
7. Implement graceful degradation paths

## Acceptance Criteria
- [ ] No stack traces shown to users
- [ ] All errors have user-friendly messages
- [ ] Recovery suggestions provided
- [ ] Errors logged to `.dex/error.log`
- [ ] Commands can recover from non-fatal errors
- [ ] Exit codes properly indicate error types
- [ ] Debug mode shows detailed errors

## Error Categories
- Git errors (not a repo, no commits, etc.)
- File system errors (permissions, missing files)
- Parser errors (unsupported language, syntax errors)
- Network errors (for URL tasks)
- Configuration errors
- User input errors

## 1. Complete ErrorBoundary Class Implementation

### Core Error Boundary (`src/core/errors/boundary.ts`)

```typescript
import { BaseError, ErrorCode, ErrorSeverity, RecoveryStrategy } from './types';
import { ErrorRecoveryManager } from './recovery';
import { ErrorFormatter } from './formatter';
import { ErrorLogger } from './logger';
import chalk from 'chalk';
import { promises as fs } from 'fs';
import path from 'path';

export interface ErrorBoundaryOptions {
    debugMode?: boolean;
    logFile?: string;
    exitOnFatal?: boolean;
    maxRetries?: number;
    recoveryTimeout?: number;
}

export class ErrorBoundary {
    private logger: ErrorLogger;
    private recoveryManager: ErrorRecoveryManager;
    private formatter: ErrorFormatter;
    private options: Required<ErrorBoundaryOptions>;
    private activeRecoveries = new Map<string, Promise<any>>();

    constructor(options: ErrorBoundaryOptions = {}) {
        this.options = {
            debugMode: process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development',
            logFile: '.dex/error.log',
            exitOnFatal: true,
            maxRetries: 3,
            recoveryTimeout: 30000, // 30 seconds
            ...options
        };

        this.logger = new ErrorLogger(this.options.logFile);
        this.recoveryManager = new ErrorRecoveryManager(this.options);
        this.formatter = new ErrorFormatter(this.options.debugMode);
    }

    /**
     * Main error boundary wrapper for async functions
     */
    async wrap<T>(
        operation: () => Promise<T>,
        context: string,
        recoveryStrategies?: RecoveryStrategy[]
    ): Promise<T> {
        let attempts = 0;
        let lastError: BaseError;

        while (attempts < this.options.maxRetries) {
            try {
                return await operation();
            } catch (error) {
                attempts++;
                lastError = this.normalizeError(error, context);
                
                // Log the error immediately
                await this.logger.logError(lastError, { attempt: attempts, context });
                
                // Don't retry fatal errors
                if (lastError.severity === ErrorSeverity.FATAL) {
                    break;
                }
                
                // Try recovery strategies
                if (recoveryStrategies && attempts <= this.options.maxRetries) {
                    const recovered = await this.attemptRecovery(
                        lastError,
                        recoveryStrategies,
                        context
                    );
                    if (recovered) {
                        continue; // Retry the operation
                    }
                }
                
                // If it's the last attempt or no recovery possible, break
                if (attempts >= this.options.maxRetries || 
                    lastError.severity === ErrorSeverity.CRITICAL) {
                    break;
                }
                
                // Wait before retry (exponential backoff)
                await this.sleep(Math.min(1000 * Math.pow(2, attempts - 1), 5000));
            }
        }

        // All retries exhausted, handle the error
        return this.handleError(lastError!, context);
    }

    /**
     * Synchronous error boundary wrapper
     */
    wrapSync<T>(
        operation: () => T,
        context: string,
        fallback?: T
    ): T {
        try {
            return operation();
        } catch (error) {
            const normalizedError = this.normalizeError(error, context);
            
            // Log synchronously (fire and forget)
            this.logger.logError(normalizedError, { context }).catch(() => {});
            
            if (fallback !== undefined) {
                console.warn(
                    this.formatter.formatWarning(
                        `Operation failed, using fallback: ${normalizedError.message}`
                    )
                );
                return fallback;
            }
            
            return this.handleErrorSync(normalizedError, context);
        }
    }

    /**
     * Handle errors with appropriate user messaging and recovery
     */
    private async handleError<T>(error: BaseError, context: string): Promise<T> {
        // Show user-friendly error message
        console.error(this.formatter.formatError(error));
        
        // Show recovery suggestions
        const suggestions = this.formatter.formatSuggestions(error);
        if (suggestions) {
            console.log(suggestions);
        }
        
        // In debug mode, show additional details
        if (this.options.debugMode) {
            console.error(this.formatter.formatDebugInfo(error, context));
        }
        
        // Exit with appropriate code based on error severity
        if (this.options.exitOnFatal) {
            process.exit(this.getExitCode(error));
        }
        
        throw error;
    }

    /**
     * Handle synchronous errors
     */
    private handleErrorSync<T>(error: BaseError, context: string): T {
        console.error(this.formatter.formatError(error));
        
        const suggestions = this.formatter.formatSuggestions(error);
        if (suggestions) {
            console.log(suggestions);
        }
        
        if (this.options.debugMode) {
            console.error(this.formatter.formatDebugInfo(error, context));
        }
        
        if (this.options.exitOnFatal) {
            process.exit(this.getExitCode(error));
        }
        
        throw error;
    }

    /**
     * Attempt error recovery using provided strategies
     */
    private async attemptRecovery(
        error: BaseError,
        strategies: RecoveryStrategy[],
        context: string
    ): Promise<boolean> {
        const recoveryKey = `${context}-${error.code}`;
        
        // Prevent concurrent recovery attempts for the same error
        if (this.activeRecoveries.has(recoveryKey)) {
            await this.activeRecoveries.get(recoveryKey);
            return true;
        }
        
        const recoveryPromise = this.performRecovery(error, strategies, context);
        this.activeRecoveries.set(recoveryKey, recoveryPromise);
        
        try {
            const result = await Promise.race([
                recoveryPromise,
                this.timeout(this.options.recoveryTimeout)
            ]);
            return result;
        } catch (recoveryError) {
            console.warn(
                this.formatter.formatWarning(
                    `Recovery failed: ${recoveryError instanceof Error ? recoveryError.message : 'Unknown error'}`
                )
            );
            return false;
        } finally {
            this.activeRecoveries.delete(recoveryKey);
        }
    }

    /**
     * Perform actual recovery using strategies
     */
    private async performRecovery(
        error: BaseError,
        strategies: RecoveryStrategy[],
        context: string
    ): Promise<boolean> {
        for (const strategy of strategies) {
            try {
                console.log(
                    chalk.yellow(`🔧 Attempting recovery: ${strategy.description}`)
                );
                
                const recovered = await this.recoveryManager.executeStrategy(
                    strategy,
                    error,
                    context
                );
                
                if (recovered) {
                    console.log(
                        chalk.green(`✅ Recovery successful: ${strategy.description}`)
                    );
                    await this.logger.logRecovery(error, strategy, context);
                    return true;
                }
            } catch (recoveryError) {
                console.warn(
                    chalk.yellow(
                        `⚠️ Recovery strategy failed: ${strategy.description}`
                    )
                );
            }
        }
        return false;
    }

    /**
     * Normalize any error into our BaseError format
     */
    private normalizeError(error: unknown, context: string): BaseError {
        if (error instanceof BaseError) {
            return error;
        }
        
        if (error instanceof Error) {
            return BaseError.from(error, context);
        }
        
        return new BaseError(
            ErrorCode.UNKNOWN,
            typeof error === 'string' ? error : 'Unknown error occurred',
            ErrorSeverity.CRITICAL,
            context,
            { originalError: error }
        );
    }

    /**
     * Get appropriate exit code for error severity
     */
    private getExitCode(error: BaseError): number {
        switch (error.severity) {
            case ErrorSeverity.INFO:
            case ErrorSeverity.WARNING:
                return 0;
            case ErrorSeverity.ERROR:
                return 1;
            case ErrorSeverity.CRITICAL:
                return 2;
            case ErrorSeverity.FATAL:
                return 3;
            default:
                return 1;
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private timeout(ms: number): Promise<never> {
        return new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Recovery timeout')), ms);
        });
    }
}

// Global instance for convenience
let globalBoundary: ErrorBoundary | null = null;

export function getErrorBoundary(options?: ErrorBoundaryOptions): ErrorBoundary {
    if (!globalBoundary) {
        globalBoundary = new ErrorBoundary(options);
    }
    return globalBoundary;
}

export function resetErrorBoundary(): void {
    globalBoundary = null;
}
```

## 2. Error Type Hierarchy and Categorization (`src/core/errors/types.ts`)

```typescript
/**
 * Error severity levels
 */
export enum ErrorSeverity {
    INFO = 'info',
    WARNING = 'warning',
    ERROR = 'error',
    CRITICAL = 'critical',
    FATAL = 'fatal'
}

/**
 * Comprehensive error codes for different error types
 */
export enum ErrorCode {
    // Git errors
    GIT_NOT_REPOSITORY = 'GIT_NOT_REPOSITORY',
    GIT_NO_COMMITS = 'GIT_NO_COMMITS',
    GIT_INVALID_REFERENCE = 'GIT_INVALID_REFERENCE',
    GIT_MERGE_CONFLICT = 'GIT_MERGE_CONFLICT',
    GIT_AUTHENTICATION = 'GIT_AUTHENTICATION',
    GIT_NETWORK_ERROR = 'GIT_NETWORK_ERROR',
    GIT_CORRUPT_REPOSITORY = 'GIT_CORRUPT_REPOSITORY',
    
    // File system errors
    FILE_NOT_FOUND = 'FILE_NOT_FOUND',
    FILE_PERMISSION_DENIED = 'FILE_PERMISSION_DENIED',
    FILE_ALREADY_EXISTS = 'FILE_ALREADY_EXISTS',
    DIRECTORY_NOT_FOUND = 'DIRECTORY_NOT_FOUND',
    DIRECTORY_NOT_EMPTY = 'DIRECTORY_NOT_EMPTY',
    DISK_FULL = 'DISK_FULL',
    FILE_TOO_LARGE = 'FILE_TOO_LARGE',
    
    // Parser errors
    PARSER_UNSUPPORTED_LANGUAGE = 'PARSER_UNSUPPORTED_LANGUAGE',
    PARSER_SYNTAX_ERROR = 'PARSER_SYNTAX_ERROR',
    PARSER_ENCODING_ERROR = 'PARSER_ENCODING_ERROR',
    PARSER_TIMEOUT = 'PARSER_TIMEOUT',
    PARSER_MEMORY_ERROR = 'PARSER_MEMORY_ERROR',
    
    // Network errors
    NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
    NETWORK_CONNECTION_REFUSED = 'NETWORK_CONNECTION_REFUSED',
    NETWORK_DNS_ERROR = 'NETWORK_DNS_ERROR',
    NETWORK_SSL_ERROR = 'NETWORK_SSL_ERROR',
    NETWORK_HTTP_ERROR = 'NETWORK_HTTP_ERROR',
    
    // Configuration errors
    CONFIG_NOT_FOUND = 'CONFIG_NOT_FOUND',
    CONFIG_INVALID_FORMAT = 'CONFIG_INVALID_FORMAT',
    CONFIG_MISSING_REQUIRED = 'CONFIG_MISSING_REQUIRED',
    CONFIG_INVALID_VALUE = 'CONFIG_INVALID_VALUE',
    
    // User input errors
    INPUT_INVALID_FORMAT = 'INPUT_INVALID_FORMAT',
    INPUT_OUT_OF_RANGE = 'INPUT_OUT_OF_RANGE',
    INPUT_MISSING_REQUIRED = 'INPUT_MISSING_REQUIRED',
    INPUT_CONFLICTING_OPTIONS = 'INPUT_CONFLICTING_OPTIONS',
    
    // System errors
    SYSTEM_OUT_OF_MEMORY = 'SYSTEM_OUT_OF_MEMORY',
    SYSTEM_PERMISSION_DENIED = 'SYSTEM_PERMISSION_DENIED',
    SYSTEM_RESOURCE_EXHAUSTED = 'SYSTEM_RESOURCE_EXHAUSTED',
    SYSTEM_INTERRUPTED = 'SYSTEM_INTERRUPTED',
    
    // Application errors
    OPERATION_CANCELLED = 'OPERATION_CANCELLED',
    OPERATION_TIMEOUT = 'OPERATION_TIMEOUT',
    OPERATION_FAILED = 'OPERATION_FAILED',
    DEPENDENCY_MISSING = 'DEPENDENCY_MISSING',
    
    // Unknown/generic
    UNKNOWN = 'UNKNOWN'
}

/**
 * Recovery strategy interface
 */
export interface RecoveryStrategy {
    code: ErrorCode;
    description: string;
    action: (error: BaseError, context: string) => Promise<boolean>;
    retryable: boolean;
    timeout?: number;
}

/**
 * Base error class with rich metadata
 */
export class BaseError extends Error {
    public readonly code: ErrorCode;
    public readonly severity: ErrorSeverity;
    public readonly context: string;
    public readonly timestamp: Date;
    public readonly metadata: Record<string, any>;
    public readonly suggestions: string[];
    public readonly originalError?: Error;

    constructor(
        code: ErrorCode,
        message: string,
        severity: ErrorSeverity,
        context: string,
        metadata: Record<string, any> = {},
        suggestions: string[] = [],
        originalError?: Error
    ) {
        super(message);
        this.name = 'BaseError';
        this.code = code;
        this.severity = severity;
        this.context = context;
        this.timestamp = new Date();
        this.metadata = metadata;
        this.suggestions = suggestions;
        this.originalError = originalError;
        
        // Maintain proper stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, BaseError);
        }
    }

    /**
     * Create BaseError from any error
     */
    static from(
        error: Error,
        context: string,
        severity: ErrorSeverity = ErrorSeverity.ERROR
    ): BaseError {
        const code = this.inferErrorCode(error);
        const suggestions = this.generateSuggestions(code, error);
        
        return new BaseError(
            code,
            error.message,
            severity,
            context,
            { stack: error.stack },
            suggestions,
            error
        );
    }

    /**
     * Infer error code from error message and type
     */
    private static inferErrorCode(error: Error): ErrorCode {
        const message = error.message.toLowerCase();
        
        // Git errors
        if (message.includes('not a git repository')) {
            return ErrorCode.GIT_NOT_REPOSITORY;
        }
        if (message.includes('does not have any commits')) {
            return ErrorCode.GIT_NO_COMMITS;
        }
        if (message.includes('unknown revision')) {
            return ErrorCode.GIT_INVALID_REFERENCE;
        }
        
        // File system errors
        if (message.includes('enoent') || message.includes('no such file')) {
            return ErrorCode.FILE_NOT_FOUND;
        }
        if (message.includes('eacces') || message.includes('permission denied')) {
            return ErrorCode.FILE_PERMISSION_DENIED;
        }
        if (message.includes('enospc') || message.includes('no space left')) {
            return ErrorCode.DISK_FULL;
        }
        
        // Network errors
        if (message.includes('timeout') || message.includes('etimedout')) {
            return ErrorCode.NETWORK_TIMEOUT;
        }
        if (message.includes('connection refused') || message.includes('econnrefused')) {
            return ErrorCode.NETWORK_CONNECTION_REFUSED;
        }
        if (message.includes('getaddrinfo') || message.includes('enotfound')) {
            return ErrorCode.NETWORK_DNS_ERROR;
        }
        
        // Parser errors
        if (message.includes('syntax error') || message.includes('parse error')) {
            return ErrorCode.PARSER_SYNTAX_ERROR;
        }
        
        return ErrorCode.UNKNOWN;
    }

    /**
     * Generate helpful suggestions based on error code
     */
    private static generateSuggestions(code: ErrorCode, error: Error): string[] {
        const suggestions: string[] = [];
        
        switch (code) {
            case ErrorCode.GIT_NOT_REPOSITORY:
                suggestions.push('Initialize a git repository with: git init');
                suggestions.push('Or run this command from within a git repository');
                break;
                
            case ErrorCode.GIT_NO_COMMITS:
                suggestions.push('Make your first commit: git commit -m "Initial commit"');
                break;
                
            case ErrorCode.FILE_NOT_FOUND:
                suggestions.push('Verify the file path is correct');
                suggestions.push('Check if the file was moved or deleted');
                break;
                
            case ErrorCode.FILE_PERMISSION_DENIED:
                suggestions.push('Check file permissions with: ls -la');
                suggestions.push('Run with appropriate permissions or change file ownership');
                break;
                
            case ErrorCode.DISK_FULL:
                suggestions.push('Free up disk space');
                suggestions.push('Try a different output directory');
                break;
                
            case ErrorCode.NETWORK_TIMEOUT:
                suggestions.push('Check your internet connection');
                suggestions.push('Try again later - the server might be busy');
                break;
                
            case ErrorCode.PARSER_UNSUPPORTED_LANGUAGE:
                suggestions.push('Check if the file extension is supported');
                suggestions.push('Use --type flag to specify the file type');
                break;
        }
        
        return suggestions;
    }

    /**
     * Convert to JSON for logging
     */
    toJSON(): object {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            severity: this.severity,
            context: this.context,
            timestamp: this.timestamp.toISOString(),
            metadata: this.metadata,
            suggestions: this.suggestions,
            stack: this.stack
        };
    }
}

// Specific error classes
export class GitError extends BaseError {
    constructor(
        code: ErrorCode,
        message: string,
        severity: ErrorSeverity = ErrorSeverity.ERROR,
        context: string = 'git',
        metadata: Record<string, any> = {}
    ) {
        super(code, message, severity, context, metadata);
        this.name = 'GitError';
    }
}

export class FileSystemError extends BaseError {
    constructor(
        code: ErrorCode,
        message: string,
        severity: ErrorSeverity = ErrorSeverity.ERROR,
        context: string = 'filesystem',
        metadata: Record<string, any> = {}
    ) {
        super(code, message, severity, context, metadata);
        this.name = 'FileSystemError';
    }
}

export class ParserError extends BaseError {
    constructor(
        code: ErrorCode,
        message: string,
        severity: ErrorSeverity = ErrorSeverity.ERROR,
        context: string = 'parser',
        metadata: Record<string, any> = {}
    ) {
        super(code, message, severity, context, metadata);
        this.name = 'ParserError';
    }
}

export class NetworkError extends BaseError {
    constructor(
        code: ErrorCode,
        message: string,
        severity: ErrorSeverity = ErrorSeverity.ERROR,
        context: string = 'network',
        metadata: Record<string, any> = {}
    ) {
        super(code, message, severity, context, metadata);
        this.name = 'NetworkError';
    }
}

export class ConfigurationError extends BaseError {
    constructor(
        code: ErrorCode,
        message: string,
        severity: ErrorSeverity = ErrorSeverity.ERROR,
        context: string = 'configuration',
        metadata: Record<string, any> = {}
    ) {
        super(code, message, severity, context, metadata);
        this.name = 'ConfigurationError';
    }
}

export class UserInputError extends BaseError {
    constructor(
        code: ErrorCode,
        message: string,
        severity: ErrorSeverity = ErrorSeverity.WARNING,
        context: string = 'user-input',
        metadata: Record<string, any> = {}
    ) {
        super(code, message, severity, context, metadata);
        this.name = 'UserInputError';
    }
}
```

## 3. User-Friendly Error Message Templates (`src/core/errors/formatter.ts`)

```typescript
import { BaseError, ErrorCode, ErrorSeverity } from './types';
import chalk from 'chalk';

export class ErrorFormatter {
    constructor(private debugMode: boolean = false) {}

    /**
     * Format error for user display
     */
    formatError(error: BaseError): string {
        const icon = this.getSeverityIcon(error.severity);
        const colorFn = this.getSeverityColor(error.severity);
        const title = this.getErrorTitle(error.code);
        
        let output = colorFn(`${icon} ${title}\n`);
        output += `   ${error.message}\n`;
        
        // Add context if available and meaningful
        if (error.context && error.context !== 'unknown') {
            output += chalk.dim(`   Context: ${error.context}\n`);
        }
        
        // Add metadata if relevant
        const relevantMetadata = this.extractRelevantMetadata(error);
        if (relevantMetadata.length > 0) {
            output += chalk.dim(`   Details: ${relevantMetadata.join(', ')}\n`);
        }
        
        return output;
    }

    /**
     * Format recovery suggestions
     */
    formatSuggestions(error: BaseError): string | null {
        if (!error.suggestions || error.suggestions.length === 0) {
            return null;
        }
        
        let output = chalk.yellow('\n💡 Suggestions:\n');
        for (const suggestion of error.suggestions) {
            output += chalk.yellow(`   • ${suggestion}\n`);
        }
        
        return output;
    }

    /**
     * Format warning message
     */
    formatWarning(message: string): string {
        return chalk.yellow(`⚠️  ${message}`);
    }

    /**
     * Format debug information
     */
    formatDebugInfo(error: BaseError, context: string): string {
        if (!this.debugMode) {
            return '';
        }
        
        let output = chalk.gray('\n🐛 Debug Information:\n');
        output += chalk.gray(`   Error Code: ${error.code}\n`);
        output += chalk.gray(`   Severity: ${error.severity}\n`);
        output += chalk.gray(`   Context: ${context}\n`);
        output += chalk.gray(`   Timestamp: ${error.timestamp.toISOString()}\n`);
        
        if (Object.keys(error.metadata).length > 0) {
            output += chalk.gray(`   Metadata: ${JSON.stringify(error.metadata, null, 2)}\n`);
        }
        
        if (error.stack) {
            output += chalk.gray(`   Stack Trace:\n${error.stack}\n`);
        }
        
        return output;
    }

    /**
     * Format success message with recovery info
     */
    formatRecoverySuccess(description: string, details?: string): string {
        let output = chalk.green(`✅ Recovery successful: ${description}\n`);
        if (details) {
            output += chalk.green(`   ${details}\n`);
        }
        return output;
    }

    /**
     * Get severity-appropriate icon
     */
    private getSeverityIcon(severity: ErrorSeverity): string {
        switch (severity) {
            case ErrorSeverity.INFO:
                return 'ℹ️';
            case ErrorSeverity.WARNING:
                return '⚠️';
            case ErrorSeverity.ERROR:
                return '❌';
            case ErrorSeverity.CRITICAL:
                return '🚨';
            case ErrorSeverity.FATAL:
                return '💀';
            default:
                return '❓';
        }
    }

    /**
     * Get severity-appropriate color function
     */
    private getSeverityColor(severity: ErrorSeverity): (text: string) => string {
        switch (severity) {
            case ErrorSeverity.INFO:
                return chalk.blue;
            case ErrorSeverity.WARNING:
                return chalk.yellow;
            case ErrorSeverity.ERROR:
                return chalk.red;
            case ErrorSeverity.CRITICAL:
                return chalk.redBright;
            case ErrorSeverity.FATAL:
                return chalk.bgRed.white;
            default:
                return chalk.gray;
        }
    }

    /**
     * Get user-friendly error title
     */
    private getErrorTitle(code: ErrorCode): string {
        const titles: Record<ErrorCode, string> = {
            // Git errors
            [ErrorCode.GIT_NOT_REPOSITORY]: 'Not a Git Repository',
            [ErrorCode.GIT_NO_COMMITS]: 'No Git Commits Found',
            [ErrorCode.GIT_INVALID_REFERENCE]: 'Invalid Git Reference',
            [ErrorCode.GIT_MERGE_CONFLICT]: 'Git Merge Conflict',
            [ErrorCode.GIT_AUTHENTICATION]: 'Git Authentication Failed',
            [ErrorCode.GIT_NETWORK_ERROR]: 'Git Network Error',
            [ErrorCode.GIT_CORRUPT_REPOSITORY]: 'Corrupt Git Repository',
            
            // File system errors
            [ErrorCode.FILE_NOT_FOUND]: 'File Not Found',
            [ErrorCode.FILE_PERMISSION_DENIED]: 'Permission Denied',
            [ErrorCode.FILE_ALREADY_EXISTS]: 'File Already Exists',
            [ErrorCode.DIRECTORY_NOT_FOUND]: 'Directory Not Found',
            [ErrorCode.DIRECTORY_NOT_EMPTY]: 'Directory Not Empty',
            [ErrorCode.DISK_FULL]: 'Disk Full',
            [ErrorCode.FILE_TOO_LARGE]: 'File Too Large',
            
            // Parser errors
            [ErrorCode.PARSER_UNSUPPORTED_LANGUAGE]: 'Unsupported Language',
            [ErrorCode.PARSER_SYNTAX_ERROR]: 'Syntax Error',
            [ErrorCode.PARSER_ENCODING_ERROR]: 'File Encoding Error',
            [ErrorCode.PARSER_TIMEOUT]: 'Parser Timeout',
            [ErrorCode.PARSER_MEMORY_ERROR]: 'Parser Out of Memory',
            
            // Network errors
            [ErrorCode.NETWORK_TIMEOUT]: 'Network Timeout',
            [ErrorCode.NETWORK_CONNECTION_REFUSED]: 'Connection Refused',
            [ErrorCode.NETWORK_DNS_ERROR]: 'DNS Resolution Failed',
            [ErrorCode.NETWORK_SSL_ERROR]: 'SSL/TLS Error',
            [ErrorCode.NETWORK_HTTP_ERROR]: 'HTTP Error',
            
            // Configuration errors
            [ErrorCode.CONFIG_NOT_FOUND]: 'Configuration Not Found',
            [ErrorCode.CONFIG_INVALID_FORMAT]: 'Invalid Configuration Format',
            [ErrorCode.CONFIG_MISSING_REQUIRED]: 'Missing Required Configuration',
            [ErrorCode.CONFIG_INVALID_VALUE]: 'Invalid Configuration Value',
            
            // User input errors
            [ErrorCode.INPUT_INVALID_FORMAT]: 'Invalid Input Format',
            [ErrorCode.INPUT_OUT_OF_RANGE]: 'Input Out of Range',
            [ErrorCode.INPUT_MISSING_REQUIRED]: 'Missing Required Input',
            [ErrorCode.INPUT_CONFLICTING_OPTIONS]: 'Conflicting Options',
            
            // System errors
            [ErrorCode.SYSTEM_OUT_OF_MEMORY]: 'Out of Memory',
            [ErrorCode.SYSTEM_PERMISSION_DENIED]: 'System Permission Denied',
            [ErrorCode.SYSTEM_RESOURCE_EXHAUSTED]: 'System Resources Exhausted',
            [ErrorCode.SYSTEM_INTERRUPTED]: 'Operation Interrupted',
            
            // Application errors
            [ErrorCode.OPERATION_CANCELLED]: 'Operation Cancelled',
            [ErrorCode.OPERATION_TIMEOUT]: 'Operation Timeout',
            [ErrorCode.OPERATION_FAILED]: 'Operation Failed',
            [ErrorCode.DEPENDENCY_MISSING]: 'Missing Dependency',
            
            [ErrorCode.UNKNOWN]: 'Unknown Error'
        };
        
        return titles[code] || 'Unknown Error';
    }

    /**
     * Extract relevant metadata for display
     */
    private extractRelevantMetadata(error: BaseError): string[] {
        const relevant: string[] = [];
        
        if (error.metadata.path) {
            relevant.push(`Path: ${error.metadata.path}`);
        }
        
        if (error.metadata.filename) {
            relevant.push(`File: ${error.metadata.filename}`);
        }
        
        if (error.metadata.line) {
            relevant.push(`Line: ${error.metadata.line}`);
        }
        
        if (error.metadata.httpStatus) {
            relevant.push(`HTTP Status: ${error.metadata.httpStatus}`);
        }
        
        if (error.metadata.gitRef) {
            relevant.push(`Git Ref: ${error.metadata.gitRef}`);
        }
        
        if (error.metadata.expectedType) {
            relevant.push(`Expected: ${error.metadata.expectedType}`);
        }
        
        return relevant;
    }
}
```

## 4. Recovery Strategy Implementations (`src/core/errors/recovery.ts`)

```typescript
import { RecoveryStrategy, BaseError, ErrorCode, ErrorSeverity } from './types';
import { promises as fs } from 'fs';
import path from 'path';
import { execAsync } from '../utils/exec';
import chalk from 'chalk';

export interface RecoveryOptions {
    maxRetries: number;
    timeout: number;
}

export class ErrorRecoveryManager {
    private strategies = new Map<ErrorCode, RecoveryStrategy[]>();
    
    constructor(private options: RecoveryOptions) {
        this.initializeStrategies();
    }

    /**
     * Execute recovery strategy
     */
    async executeStrategy(
        strategy: RecoveryStrategy,
        error: BaseError,
        context: string
    ): Promise<boolean> {
        try {
            const result = await Promise.race([
                strategy.action(error, context),
                this.timeout(strategy.timeout || this.options.timeout)
            ]);
            return result;
        } catch (recoveryError) {
            console.warn(
                chalk.yellow(
                    `Recovery strategy '${strategy.description}' failed: ${recoveryError instanceof Error ? recoveryError.message : 'Unknown error'}`
                )
            );
            return false;
        }
    }

    /**
     * Get recovery strategies for error code
     */
    getStrategies(code: ErrorCode): RecoveryStrategy[] {
        return this.strategies.get(code) || [];
    }

    /**
     * Initialize all recovery strategies
     */
    private initializeStrategies(): void {
        // Git recovery strategies
        this.addStrategy(ErrorCode.GIT_NOT_REPOSITORY, {
            code: ErrorCode.GIT_NOT_REPOSITORY,
            description: 'Initialize git repository',
            action: async (error, context) => {
                const workingDir = error.metadata.path || process.cwd();
                await execAsync('git init', { cwd: workingDir });
                return true;
            },
            retryable: true,
            timeout: 5000
        });

        this.addStrategy(ErrorCode.GIT_NO_COMMITS, {
            code: ErrorCode.GIT_NO_COMMITS,
            description: 'Create initial commit',
            action: async (error, context) => {
                const workingDir = error.metadata.path || process.cwd();
                
                // Create a simple README if no files exist
                const readmePath = path.join(workingDir, 'README.md');
                if (!(await this.fileExists(readmePath))) {
                    await fs.writeFile(readmePath, '# Project\n\nGenerated by Dex\n');
                }
                
                await execAsync('git add .', { cwd: workingDir });
                await execAsync('git commit -m "Initial commit"', { cwd: workingDir });
                return true;
            },
            retryable: true,
            timeout: 10000
        });

        // File system recovery strategies
        this.addStrategy(ErrorCode.FILE_NOT_FOUND, {
            code: ErrorCode.FILE_NOT_FOUND,
            description: 'Create missing file',
            action: async (error, context) => {
                if (!error.metadata.path) return false;
                
                const filePath = error.metadata.path;
                const dir = path.dirname(filePath);
                
                // Create directory if it doesn't exist
                await fs.mkdir(dir, { recursive: true });
                
                // Create empty file or with default content
                const defaultContent = this.getDefaultFileContent(filePath);
                await fs.writeFile(filePath, defaultContent);
                
                return true;
            },
            retryable: true,
            timeout: 5000
        });

        this.addStrategy(ErrorCode.DIRECTORY_NOT_FOUND, {
            code: ErrorCode.DIRECTORY_NOT_FOUND,
            description: 'Create missing directory',
            action: async (error, context) => {
                if (!error.metadata.path) return false;
                
                await fs.mkdir(error.metadata.path, { recursive: true });
                return true;
            },
            retryable: true,
            timeout: 5000
        });

        this.addStrategy(ErrorCode.FILE_PERMISSION_DENIED, {
            code: ErrorCode.FILE_PERMISSION_DENIED,
            description: 'Fix file permissions',
            action: async (error, context) => {
                if (!error.metadata.path) return false;
                
                try {
                    // Try to make file readable
                    await fs.chmod(error.metadata.path, 0o644);
                    return true;
                } catch {
                    // If that fails, try to create a copy in temp directory
                    const tempPath = path.join('/tmp', path.basename(error.metadata.path));
                    await fs.copyFile(error.metadata.path, tempPath);
                    error.metadata.path = tempPath;
                    return true;
                }
            },
            retryable: true,
            timeout: 5000
        });

        // Parser recovery strategies
        this.addStrategy(ErrorCode.PARSER_UNSUPPORTED_LANGUAGE, {
            code: ErrorCode.PARSER_UNSUPPORTED_LANGUAGE,
            description: 'Use fallback parser',
            action: async (error, context) => {
                // Enable fallback to regex parser
                error.metadata.useFallbackParser = true;
                return true;
            },
            retryable: true
        });

        this.addStrategy(ErrorCode.PARSER_MEMORY_ERROR, {
            code: ErrorCode.PARSER_MEMORY_ERROR,
            description: 'Process file in chunks',
            action: async (error, context) => {
                // Enable chunked processing
                error.metadata.enableChunkedProcessing = true;
                error.metadata.chunkSize = 1024 * 1024; // 1MB chunks
                return true;
            },
            retryable: true
        });

        // Network recovery strategies
        this.addStrategy(ErrorCode.NETWORK_TIMEOUT, {
            code: ErrorCode.NETWORK_TIMEOUT,
            description: 'Increase timeout and retry',
            action: async (error, context) => {
                // Increase timeout for next attempt
                error.metadata.networkTimeout = (error.metadata.networkTimeout || 10000) * 2;
                return true;
            },
            retryable: true
        });

        this.addStrategy(ErrorCode.NETWORK_DNS_ERROR, {
            code: ErrorCode.NETWORK_DNS_ERROR,
            description: 'Use alternative DNS',
            action: async (error, context) => {
                // Switch to different DNS or IP if available
                if (error.metadata.alternativeUrl) {
                    error.metadata.url = error.metadata.alternativeUrl;
                    return true;
                }
                return false;
            },
            retryable: true
        });

        // Configuration recovery strategies
        this.addStrategy(ErrorCode.CONFIG_NOT_FOUND, {
            code: ErrorCode.CONFIG_NOT_FOUND,
            description: 'Create default configuration',
            action: async (error, context) => {
                const configPath = error.metadata.configPath || '.dex/config.json';
                const dir = path.dirname(configPath);
                
                await fs.mkdir(dir, { recursive: true });
                
                const defaultConfig = {
                    version: '1.0',
                    defaults: {},
                    filters: {
                        ignorePaths: ['node_modules', '.git', 'dist', 'build']
                    }
                };
                
                await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2));
                return true;
            },
            retryable: true
        });

        // Operation recovery strategies
        this.addStrategy(ErrorCode.OPERATION_TIMEOUT, {
            code: ErrorCode.OPERATION_TIMEOUT,
            description: 'Reduce scope and retry',
            action: async (error, context) => {
                // Reduce the scope of operation
                if (error.metadata.maxFiles) {
                    error.metadata.maxFiles = Math.floor(error.metadata.maxFiles / 2);
                    return true;
                }
                if (error.metadata.maxDepth) {
                    error.metadata.maxDepth = Math.max(1, error.metadata.maxDepth - 1);
                    return true;
                }
                return false;
            },
            retryable: true
        });
    }

    /**
     * Add recovery strategy
     */
    private addStrategy(code: ErrorCode, strategy: RecoveryStrategy): void {
        if (!this.strategies.has(code)) {
            this.strategies.set(code, []);
        }
        this.strategies.get(code)!.push(strategy);
    }

    /**
     * Get default content for file types
     */
    private getDefaultFileContent(filePath: string): string {
        const ext = path.extname(filePath).toLowerCase();
        
        switch (ext) {
            case '.md':
                return '# Document\n\nContent goes here.\n';
            case '.json':
                return '{\n  "version": "1.0.0"\n}\n';
            case '.js':
            case '.ts':
                return '// Generated by Dex\n\nexport {}\n';
            case '.py':
                return '# Generated by Dex\n\nif __name__ == "__main__":\n    pass\n';
            case '.yaml':
            case '.yml':
                return 'version: "1.0"\n';
            default:
                return '# Generated by Dex\n';
        }
    }

    /**
     * Check if file exists
     */
    private async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Timeout helper
     */
    private timeout(ms: number): Promise<never> {
        return new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Recovery timeout')), ms);
        });
    }
}
```

## 5. Error Logger Implementation (`src/core/errors/logger.ts`)

```typescript
import { BaseError, RecoveryStrategy } from './types';
import { promises as fs } from 'fs';
import path from 'path';
import { createWriteStream, WriteStream } from 'fs';

export interface LogEntry {
    timestamp: string;
    level: 'error' | 'recovery' | 'debug';
    context: string;
    error?: BaseError;
    recovery?: {
        strategy: string;
        success: boolean;
    };
    metadata: Record<string, any>;
}

export class ErrorLogger {
    private logStream: WriteStream | null = null;
    private logQueue: LogEntry[] = [];
    private flushing = false;

    constructor(private logFile: string) {
        this.ensureLogDirectory();
    }

    /**
     * Log error with context
     */
    async logError(
        error: BaseError,
        metadata: Record<string, any> = {}
    ): Promise<void> {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level: 'error',
            context: error.context,
            error,
            metadata: {
                ...metadata,
                severity: error.severity,
                code: error.code
            }
        };

        await this.writeLogEntry(entry);
    }

    /**
     * Log successful recovery
     */
    async logRecovery(
        error: BaseError,
        strategy: RecoveryStrategy,
        context: string
    ): Promise<void> {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level: 'recovery',
            context,
            error,
            recovery: {
                strategy: strategy.description,
                success: true
            },
            metadata: {
                errorCode: error.code,
                strategyCode: strategy.code
            }
        };

        await this.writeLogEntry(entry);
    }

    /**
     * Log debug information
     */
    async logDebug(
        message: string,
        context: string,
        metadata: Record<string, any> = {}
    ): Promise<void> {
        if (process.env.NODE_ENV !== 'development' && !process.env.DEBUG) {
            return;
        }

        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level: 'debug',
            context,
            metadata: {
                message,
                ...metadata
            }
        };

        await this.writeLogEntry(entry);
    }

    /**
     * Get recent errors from log
     */
    async getRecentErrors(limit: number = 10): Promise<LogEntry[]> {
        try {
            const content = await fs.readFile(this.logFile, 'utf-8');
            const lines = content.trim().split('\n').filter(Boolean);
            
            return lines
                .slice(-limit)
                .map(line => {
                    try {
                        return JSON.parse(line) as LogEntry;
                    } catch {
                        return null;
                    }
                })
                .filter((entry): entry is LogEntry => entry !== null)
                .reverse();
        } catch {
            return [];
        }
    }

    /**
     * Clear log file
     */
    async clearLog(): Promise<void> {
        try {
            await fs.writeFile(this.logFile, '');
        } catch {
            // Ignore errors when clearing log
        }
    }

    /**
     * Rotate log file if it gets too large
     */
    async rotateLogIfNeeded(): Promise<void> {
        try {
            const stats = await fs.stat(this.logFile);
            const maxSize = 10 * 1024 * 1024; // 10MB
            
            if (stats.size > maxSize) {
                const backupPath = `${this.logFile}.${Date.now()}.bak`;
                await fs.rename(this.logFile, backupPath);
                
                // Keep only last 3 backup files
                await this.cleanupOldBackups();
            }
        } catch {
            // Ignore rotation errors
        }
    }

    /**
     * Close logger and flush pending entries
     */
    async close(): Promise<void> {
        await this.flushQueue();
        
        if (this.logStream) {
            this.logStream.end();
            this.logStream = null;
        }
    }

    /**
     * Write log entry to file
     */
    private async writeLogEntry(entry: LogEntry): Promise<void> {
        this.logQueue.push(entry);
        
        if (!this.flushing) {
            // Flush queue asynchronously
            process.nextTick(() => this.flushQueue());
        }
    }

    /**
     * Flush queued log entries
     */
    private async flushQueue(): Promise<void> {
        if (this.flushing || this.logQueue.length === 0) {
            return;
        }

        this.flushing = true;
        
        try {
            await this.ensureLogStream();
            
            while (this.logQueue.length > 0) {
                const entry = this.logQueue.shift()!
                const line = JSON.stringify(entry) + '\n';
                
                await new Promise<void>((resolve, reject) => {
                    this.logStream!.write(line, (error) => {
                        if (error) reject(error);
                        else resolve();
                    });
                });
            }
            
            // Rotate log if needed
            await this.rotateLogIfNeeded();
        } catch (error) {
            console.warn(`Failed to write to log file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            this.flushing = false;
        }
    }

    /**
     * Ensure log directory exists
     */
    private async ensureLogDirectory(): Promise<void> {
        try {
            const logDir = path.dirname(this.logFile);
            await fs.mkdir(logDir, { recursive: true });
        } catch {
            // Ignore directory creation errors
        }
    }

    /**
     * Ensure log stream is open
     */
    private async ensureLogStream(): Promise<void> {
        if (!this.logStream) {
            this.logStream = createWriteStream(this.logFile, { flags: 'a' });
        }
    }

    /**
     * Clean up old backup files
     */
    private async cleanupOldBackups(): Promise<void> {
        try {
            const logDir = path.dirname(this.logFile);
            const basename = path.basename(this.logFile);
            const files = await fs.readdir(logDir);
            
            const backupFiles = files
                .filter(file => file.startsWith(`${basename}.`) && file.endsWith('.bak'))
                .sort()
                .reverse(); // Most recent first
            
            // Keep only the 3 most recent backup files
            for (const file of backupFiles.slice(3)) {
                await fs.unlink(path.join(logDir, file));
            }
        } catch {
            // Ignore cleanup errors
        }
    }
}
```

## 6. Integration Patterns for Wrapping Commands

### Command Wrapper Pattern (`src/core/errors/command-wrapper.ts`)

```typescript
import { ErrorBoundary, getErrorBoundary } from './boundary';
import { ErrorCode, RecoveryStrategy } from './types';
import { Command } from 'commander';

/**
 * Decorator for wrapping command actions with error boundaries
 */
export function withErrorBoundary(
    context: string,
    recoveryStrategies?: RecoveryStrategy[]
) {
    return function (
        target: any,
        propertyName: string,
        descriptor: PropertyDescriptor
    ) {
        const method = descriptor.value;
        
        descriptor.value = async function (...args: any[]) {
            const boundary = getErrorBoundary();
            return boundary.wrap(
                () => method.apply(this, args),
                context,
                recoveryStrategies
            );
        };
        
        return descriptor;
    };
}

/**
 * Wrap command action with error boundary
 */
export function wrapCommandAction(
    action: (...args: any[]) => Promise<void> | void,
    context: string,
    recoveryStrategies?: RecoveryStrategy[]
): (...args: any[]) => Promise<void> {
    return async (...args: any[]) => {
        const boundary = getErrorBoundary();
        return boundary.wrap(
            async () => {
                const result = action(...args);
                if (result instanceof Promise) {
                    await result;
                }
            },
            context,
            recoveryStrategies
        );
    };
}

/**
 * Enhanced command creation with built-in error handling
 */
export function createProtectedCommand(
    name: string,
    description: string,
    action: (...args: any[]) => Promise<void> | void,
    recoveryStrategies?: RecoveryStrategy[]
): Command {
    const command = new Command(name);
    command.description(description);
    
    const wrappedAction = wrapCommandAction(
        action,
        `command:${name}`,
        recoveryStrategies
    );
    
    return command.action(wrappedAction);
}

/**
 * Common recovery strategies for different command types
 */
export const CommonRecoveryStrategies = {
    git: [
        {
            code: ErrorCode.GIT_NOT_REPOSITORY,
            description: 'Initialize git repository',
            action: async () => true,
            retryable: true
        }
    ] as RecoveryStrategy[],
    
    filesystem: [
        {
            code: ErrorCode.FILE_NOT_FOUND,
            description: 'Create missing file',
            action: async () => true,
            retryable: true
        },
        {
            code: ErrorCode.DIRECTORY_NOT_FOUND,
            description: 'Create missing directory',
            action: async () => true,
            retryable: true
        }
    ] as RecoveryStrategy[],
    
    network: [
        {
            code: ErrorCode.NETWORK_TIMEOUT,
            description: 'Retry with increased timeout',
            action: async () => true,
            retryable: true
        }
    ] as RecoveryStrategy[]
};
```

### Example Command Integration

```typescript
// Updated distill command with error boundary
export function createDistillCommand(): Command {
    return createProtectedCommand(
        'distill',
        'Compress and distill entire codebases into token-efficient formats',
        distillCommandAction,
        [
            ...CommonRecoveryStrategies.git,
            ...CommonRecoveryStrategies.filesystem
        ]
    )
    .argument('[path]', 'Path to directory or file to distill')
    .option('-f, --format <type>', 'Processing format', 'distilled')
    .option('-o, --output <file>', 'Write output to specific file')
    .option('--stdout', 'Print output to stdout');
}

@withErrorBoundary('distill-command', CommonRecoveryStrategies.filesystem)
async function distillCommandAction(targetPath: string, options: any): Promise<void> {
    // Command implementation - errors will be automatically caught and handled
    const config = loadConfig();
    // ... rest of implementation
}
```

## 7. Debug Mode Implementation with Detailed Logging

### Debug Mode Manager (`src/core/errors/debug.ts`)

```typescript
import { BaseError, ErrorSeverity } from './types';
import { ErrorLogger } from './logger';
import chalk from 'chalk';
import { performance } from 'perf_hooks';

export interface DebugContext {
    operation: string;
    startTime: number;
    metadata: Record<string, any>;
}

export class DebugManager {
    private logger: ErrorLogger;
    private contexts = new Map<string, DebugContext>();
    private isEnabled: boolean;

    constructor(logFile: string = '.dex/debug.log') {
        this.logger = new ErrorLogger(logFile);
        this.isEnabled = process.env.DEBUG === 'true' || 
                        process.env.NODE_ENV === 'development' ||
                        process.argv.includes('--debug');
    }

    /**
     * Start debug context
     */
    startContext(id: string, operation: string, metadata: Record<string, any> = {}): void {
        if (!this.isEnabled) return;
        
        this.contexts.set(id, {
            operation,
            startTime: performance.now(),
            metadata
        });
        
        console.log(
            chalk.gray(`🐛 [DEBUG] Starting: ${operation}`),
            metadata.path ? chalk.dim(`(${metadata.path})`) : ''
        );
        
        this.logger.logDebug(
            `Started operation: ${operation}`,
            id,
            metadata
        ).catch(() => {}); // Fire and forget
    }

    /**
     * End debug context
     */
    endContext(id: string, result?: any): void {
        if (!this.isEnabled) return;
        
        const context = this.contexts.get(id);
        if (!context) return;
        
        const duration = performance.now() - context.startTime;
        
        console.log(
            chalk.gray(`🐛 [DEBUG] Completed: ${context.operation}`),
            chalk.dim(`(${duration.toFixed(2)}ms)`)
        );
        
        this.logger.logDebug(
            `Completed operation: ${context.operation}`,
            id,
            {
                ...context.metadata,
                duration,
                result: result ? typeof result : undefined
            }
        ).catch(() => {});
        
        this.contexts.delete(id);
    }

    /**
     * Log debug message
     */
    log(message: string, context: string = 'general', metadata: Record<string, any> = {}): void {
        if (!this.isEnabled) return;
        
        console.log(chalk.gray(`🐛 [DEBUG] ${message}`));
        
        this.logger.logDebug(message, context, metadata).catch(() => {});
    }

    /**
     * Log error with debug information
     */
    logError(error: BaseError, context: string, metadata: Record<string, any> = {}): void {
        if (!this.isEnabled) return;
        
        console.log(chalk.red(`🐛 [DEBUG ERROR] ${error.code}: ${error.message}`));
        console.log(chalk.red(`   Context: ${context}`));
        
        if (error.stack) {
            console.log(chalk.gray('   Stack:'));
            console.log(chalk.gray(error.stack.split('\n').slice(1, 6).join('\n')));
        }
        
        if (Object.keys(metadata).length > 0) {
            console.log(chalk.gray('   Metadata:'));
            console.log(chalk.gray(`   ${JSON.stringify(metadata, null, 2)}`));
        }
        
        this.logger.logError(error, {
            ...metadata,
            debugContext: context
        }).catch(() => {});
    }

    /**
     * Log performance metrics
     */
    logPerformance(
        operation: string,
        duration: number,
        metadata: Record<string, any> = {}
    ): void {
        if (!this.isEnabled) return;
        
        const color = duration > 1000 ? chalk.red : duration > 500 ? chalk.yellow : chalk.green;
        
        console.log(
            chalk.gray('🐛 [DEBUG PERF]'),
            color(`${operation}: ${duration.toFixed(2)}ms`)
        );
        
        this.logger.logDebug(
            `Performance: ${operation}`,
            'performance',
            {
                operation,
                duration,
                ...metadata
            }
        ).catch(() => {});
    }

    /**
     * Create debug-aware function wrapper
     */
    wrap<T extends (...args: any[]) => any>(
        fn: T,
        operation: string,
        context: string = 'wrapped-function'
    ): T {
        return ((...args: any[]) => {
            if (!this.isEnabled) {
                return fn(...args);
            }
            
            const id = `${context}-${Date.now()}`;
            this.startContext(id, operation, { args: args.length });
            
            try {
                const result = fn(...args);
                
                if (result instanceof Promise) {
                    return result.then(
                        (value) => {
                            this.endContext(id, value);
                            return value;
                        },
                        (error) => {
                            this.logError(error, context);
                            this.endContext(id, { error: true });
                            throw error;
                        }
                    );
                }
                
                this.endContext(id, result);
                return result;
            } catch (error) {
                this.logError(error as BaseError, context);
                this.endContext(id, { error: true });
                throw error;
            }
        }) as T;
    }

    /**
     * Enable or disable debug mode
     */
    setEnabled(enabled: boolean): void {
        this.isEnabled = enabled;
        
        if (enabled) {
            console.log(chalk.yellow('🐛 Debug mode enabled'));
        }
    }

    /**
     * Get debug status
     */
    isDebugEnabled(): boolean {
        return this.isEnabled;
    }

    /**
     * Close debug manager
     */
    async close(): Promise<void> {
        await this.logger.close();
    }
}

// Global debug manager
let globalDebugManager: DebugManager | null = null;

export function getDebugManager(): DebugManager {
    if (!globalDebugManager) {
        globalDebugManager = new DebugManager();
    }
    return globalDebugManager;
}

export function resetDebugManager(): void {
    if (globalDebugManager) {
        globalDebugManager.close().catch(() => {});
    }
    globalDebugManager = null;
}

// Convenience functions
export const debug = {
    log: (message: string, context?: string, metadata?: Record<string, any>) => {
        getDebugManager().log(message, context, metadata);
    },
    
    error: (error: BaseError, context: string, metadata?: Record<string, any>) => {
        getDebugManager().logError(error, context, metadata);
    },
    
    perf: (operation: string, duration: number, metadata?: Record<string, any>) => {
        getDebugManager().logPerformance(operation, duration, metadata);
    },
    
    wrap: <T extends (...args: any[]) => any>(
        fn: T,
        operation: string,
        context?: string
    ): T => {
        return getDebugManager().wrap(fn, operation, context);
    },
    
    context: {
        start: (id: string, operation: string, metadata?: Record<string, any>) => {
            getDebugManager().startContext(id, operation, metadata);
        },
        
        end: (id: string, result?: any) => {
            getDebugManager().endContext(id, result);
        }
    }
};
```

## Files to Create/Modify
- `src/core/errors/boundary.ts` - main error boundary class
- `src/core/errors/types.ts` - comprehensive error type definitions
- `src/core/errors/recovery.ts` - recovery strategy implementations 
- `src/core/errors/formatter.ts` - user-friendly error formatting
- `src/core/errors/logger.ts` - error logging system
- `src/core/errors/command-wrapper.ts` - command integration patterns
- `src/core/errors/debug.ts` - debug mode implementation
- `src/core/utils/exec.ts` - utility for executing commands safely
- Update all command files to use error boundaries
- Update `src/types.ts` to include error boundary options

## Testing Requirements
- Unit tests for error boundary class (`src/core/errors/boundary.test.ts`)
- Integration tests for error recovery (`src/core/errors/recovery.test.ts`) 
- Tests for error formatting (`src/core/errors/formatter.test.ts`)
- Tests for debug mode functionality (`src/core/errors/debug.test.ts`)
- Integration tests with actual commands
- Test all error categories and recovery strategies
- Verify no stack traces leak to users
- Test graceful degradation scenarios
- Performance tests for error boundary overhead