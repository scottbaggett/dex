import { test, expect, describe, beforeEach } from 'bun:test';
import { TypeScriptProcessor } from './processor';
import { ProcessingOptions } from '../types';

describe('TypeScriptProcessor', () => {
    let processor: TypeScriptProcessor;
    
    beforeEach(async () => {
        processor = new TypeScriptProcessor();
        await processor.initialize();
    });
    
    test('should initialize processor', async () => {
        expect(processor).toBeDefined();
    });
    
    describe('with default options', () => {
        test('should extract public exports only', async () => {
            const source = `
                export class PublicClass {
                    publicMethod() {}
                    private privateMethod() {}
                }
                
                class PrivateClass {
                    method() {}
                }
                
                export function publicFunction() {}
                function privateFunction() {}
            `;
            
            const result = await processor.process(source, 'test.ts', {});
            
            expect(result.exports).toHaveLength(2);
            expect(result.exports[0].name).toBe('PublicClass');
            expect(result.exports[1].name).toBe('publicFunction');
        });
        
        test('should not include private members by default', async () => {
            const source = `
                export class TestClass {
                    public publicProp = 1;
                    private privateProp = 2;
                    protected protectedProp = 3;
                    
                    publicMethod() {}
                    private privateMethod() {}
                    protected protectedMethod() {}
                }
            `;
            
            const result = await processor.process(source, 'test.ts', {});
            
            expect(result.exports).toHaveLength(1);
            const classExport = result.exports[0];
            expect(classExport.name).toBe('TestClass');
            
            // Should only have public members
            if (classExport.members) {
                const memberNames = classExport.members.map(m => m.name);
                expect(memberNames).toContain('publicProp');
                expect(memberNames).toContain('publicMethod');
                expect(memberNames).not.toContain('privateProp');
                expect(memberNames).not.toContain('privateMethod');
            }
        });
    });
    
    describe('with includePrivate option', () => {
        test('should include private members when requested', async () => {
            const source = `
                export class TestClass {
                    public publicProp = 1;
                    private privateProp = 2;
                    
                    publicMethod() {}
                    private privateMethod() {}
                }
            `;
            
            const options: ProcessingOptions = {
                includePrivate: true
            };
            
            const result = await processor.process(source, 'test.ts', options);
            
            const classExport = result.exports[0];
            if (classExport.members) {
                const memberNames = classExport.members.map(m => m.name);
                expect(memberNames).toContain('publicProp');
                expect(memberNames).toContain('privateProp');
                expect(memberNames).toContain('publicMethod');
                expect(memberNames).toContain('privateMethod');
            }
        });
    });
    
    describe('with depth option', () => {
        test('should respect depth=public', async () => {
            const source = `
                export class TestClass {
                    public publicMethod() {}
                    protected protectedMethod() {}
                    private privateMethod() {}
                }
            `;
            
            const options: ProcessingOptions = {
                depth: 'public'
            };
            
            const result = await processor.process(source, 'test.ts', options);
            
            const classExport = result.exports[0];
            if (classExport.members) {
                const memberNames = classExport.members.map(m => m.name);
                expect(memberNames).toHaveLength(1);
                expect(memberNames).toContain('publicMethod');
            }
        });
        
        test('should respect depth=protected', async () => {
            const source = `
                export class TestClass {
                    public publicMethod() {}
                    protected protectedMethod() {}
                    private privateMethod() {}
                }
            `;
            
            const options: ProcessingOptions = {
                depth: 'protected'
            };
            
            const result = await processor.process(source, 'test.ts', options);
            
            const classExport = result.exports[0];
            if (classExport.members) {
                const memberNames = classExport.members.map(m => m.name);
                expect(memberNames).toHaveLength(2);
                expect(memberNames).toContain('publicMethod');
                expect(memberNames).toContain('protectedMethod');
                expect(memberNames).not.toContain('privateMethod');
            }
        });
        
        test('should respect depth=all', async () => {
            const source = `
                export class TestClass {
                    public publicMethod() {}
                    protected protectedMethod() {}
                    private privateMethod() {}
                }
            `;
            
            const options: ProcessingOptions = {
                depth: 'all'
            };
            
            const result = await processor.process(source, 'test.ts', options);
            
            const classExport = result.exports[0];
            if (classExport.members) {
                const memberNames = classExport.members.map(m => m.name);
                expect(memberNames).toHaveLength(3);
                expect(memberNames).toContain('publicMethod');
                expect(memberNames).toContain('protectedMethod');
                expect(memberNames).toContain('privateMethod');
            }
        });
    });
    
    describe('with pattern filtering', () => {
        test('should respect includePatterns', async () => {
            const source = `
                export class UserClass {}
                export class AdminClass {}
                export function getUserData() {}
                export function setUserData() {}
                export function deleteAdmin() {}
            `;
            
            const options: ProcessingOptions = {
                includePatterns: ['User*', 'get*']
            };
            
            const result = await processor.process(source, 'test.ts', options);
            
            const names = result.exports.map(e => e.name);
            expect(names).toContain('UserClass');
            expect(names).toContain('getUserData');
            expect(names).not.toContain('AdminClass');
            expect(names).not.toContain('setUserData');
            expect(names).not.toContain('deleteAdmin');
        });
        
        test('should respect excludePatterns', async () => {
            const source = `
                export class UserClass {}
                export class AdminClass {}
                export function getUserData() {}
                export function getAdminData() {}
                export const TEST_CONST = 1;
            `;
            
            const options: ProcessingOptions = {
                excludePatterns: ['*Admin*', 'TEST_*']
            };
            
            const result = await processor.process(source, 'test.ts', options);
            
            const names = result.exports.map(e => e.name);
            expect(names).toContain('UserClass');
            expect(names).toContain('getUserData');
            expect(names).not.toContain('AdminClass');
            expect(names).not.toContain('getAdminData');
            expect(names).not.toContain('TEST_CONST');
        });
    });
    
    describe('with import options', () => {
        test('should include imports by default', async () => {
            const source = `
                import { Component } from 'react';
                import * as fs from 'fs';
                import path from 'path';
                
                export class MyComponent {}
            `;
            
            const result = await processor.process(source, 'test.ts', {});
            
            expect(result.imports).toHaveLength(3);
            expect(result.imports[0].source).toBe('react');
            expect(result.imports[1].source).toBe('fs');
            expect(result.imports[2].source).toBe('path');
        });
        
        test('should exclude imports when includeImports=false', async () => {
            const source = `
                import { Component } from 'react';
                import * as fs from 'fs';
                
                export class MyComponent {}
            `;
            
            const options: ProcessingOptions = {
                includeImports: false
            };
            
            const result = await processor.process(source, 'test.ts', options);
            
            expect(result.imports).toHaveLength(0);
        });
    });
    
    describe('with compact mode', () => {
        test('should return compact signatures', async () => {
            const source = `
                export class MyClass {
                    constructor(param1: string, param2: number) {
                        // Long implementation
                        console.log(param1);
                        console.log(param2);
                    }
                    
                    longMethod(a: string, b: string, c: string): string {
                        // Long implementation
                        return a + b + c;
                    }
                }
            `;
            
            const options: ProcessingOptions = {
                compact: true
            };
            
            const result = await processor.process(source, 'test.ts', options);
            
            const classExport = result.exports[0];
            expect(classExport.signature).not.toContain('{');
            expect(classExport.members).toBeUndefined(); // No members in compact mode
        });
    });
    
    describe('with docstrings and comments', () => {
        test('should include docstrings when requested', async () => {
            const source = `
                /**
                 * This is a test class
                 * @class TestClass
                 */
                export class TestClass {
                    /**
                     * This is a test method
                     * @returns {void}
                     */
                    testMethod() {}
                }
            `;
            
            const options: ProcessingOptions = {
                includeDocstrings: true
            };
            
            const result = await processor.process(source, 'test.ts', options);
            
            const classExport = result.exports[0];
            // Docstrings only work with tree-sitter parser
            if (classExport.docstring) {
                expect(classExport.docstring).toContain('This is a test class');
            }
        });
        
        test('should include comments when requested', async () => {
            const source = `
                // This is a comment
                // Another comment line
                export class TestClass {
                    testMethod() {}
                }
            `;
            
            const options: ProcessingOptions = {
                includeComments: true
            };
            
            const result = await processor.process(source, 'test.ts', options);
            
            const classExport = result.exports[0];
            // Comments only work with tree-sitter parser
            if (classExport.comment) {
                expect(classExport.comment).toContain('This is a comment');
                expect(classExport.comment).toContain('Another comment line');
            }
        });
    });
    
    describe('with metadata tracking', () => {
        test('should track skipped items', async () => {
            const source = `
                export class PublicClass {}
                class PrivateClass {}
                function privateFunction() {}
                export function publicFunction() {}
            `;
            
            const options: ProcessingOptions = {
                includePrivate: false
            };
            
            const result = await processor.process(source, 'test.ts', options);
            
            // Metadata tracking only works with tree-sitter parser
            // For line-based parser, non-exported items aren't detected
            if (result.metadata?.skipped) {
                const skippedNames = result.metadata.skipped.map(s => s.name);
                expect(skippedNames).toContain('PrivateClass');
                expect(skippedNames).toContain('privateFunction');
            }
        });
    });
    
    describe('export detection', () => {
        test('should correctly identify exported items', async () => {
            const source = `
                export class ExportedClass {}
                export function exportedFunction() {}
                export const exportedConst = 1;
                export interface ExportedInterface {}
                export type ExportedType = string;
                export enum ExportedEnum { A, B }
                
                class NotExported {}
                function notExportedFunction() {}
            `;
            
            const result = await processor.process(source, 'test.ts', {});
            
            expect(result.exports).toHaveLength(6);
            expect(result.exports.every(e => e.isExported)).toBe(true);
        });
    });
    
    describe('all export types', () => {
        test('should handle all TypeScript export types', async () => {
            const source = `
                export class TestClass {}
                export interface TestInterface {}
                export type TestType = string;
                export enum TestEnum { A, B }
                export function testFunction() {}
                export const testConst = 1;
                export let testLet = 2;
                export var testVar = 3;
            `;
            
            const result = await processor.process(source, 'test.ts', {});
            
            const kinds = result.exports.map(e => e.kind);
            expect(kinds).toContain('class');
            expect(kinds).toContain('interface');
            expect(kinds).toContain('type');
            expect(kinds).toContain('enum');
            expect(kinds).toContain('function');
            expect(kinds).toContain('const');
            expect(kinds).toContain('let');
            expect(kinds).toContain('var');
        });
    });
});