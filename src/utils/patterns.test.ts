import { describe, expect, test } from "bun:test";
import {
    globPatternToRegExp,
    matchesAnyPattern,
    matchesGlobPattern,
} from "./patterns.js";

describe("pattern helpers", () => {
    test("treats '.' as a literal character", () => {
        expect(matchesGlobPattern("test.class", "test.class")).toBe(true);
        expect(matchesGlobPattern("testXclass", "test.class")).toBe(false);
    });

    test("supports wildcard and single-char tokens", () => {
        expect(matchesGlobPattern("PublicClass", "*Class")).toBe(true);
        expect(matchesGlobPattern("ab", "a?")).toBe(true);
        expect(matchesGlobPattern("abc", "a?")).toBe(false);
    });

    test("matches against any pattern in a list", () => {
        expect(matchesAnyPattern("Service", ["*Repo", "Serv*"])).toBe(true);
        expect(matchesAnyPattern("Service", ["*Repo", "Model*"])).toBe(false);
    });

    test("returns a start/end anchored regex", () => {
        const regex = globPatternToRegExp("*Service");
        expect(regex.test("MyService")).toBe(true);
        expect(regex.test("ServiceLayer")).toBe(false);
    });
});
