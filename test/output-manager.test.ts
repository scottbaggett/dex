import { describe, expect, it } from "bun:test";
import { OutputManager } from "../src/utils/output-manager";

describe("OutputManager filename and extension", () => {
    const om = new OutputManager(process.cwd());

    it("maps markdown format to .md extension", async () => {
        const filename = om.generateFilename({
            command: "extract",
            context: "sample",
            format: "markdown",
        });
        expect(filename.endsWith(".md")).toBe(true);
    });

    it("maps json format to .json extension", async () => {
        const filename = om.generateFilename({
            command: "distill",
            context: "repo",
            format: "json",
        });
        expect(filename.endsWith(".json")).toBe(true);
    });

    it("maps xml format to .xml extension", async () => {
        const filename = om.generateFilename({
            command: "combine",
            context: "ctx",
            format: "xml",
        });
        expect(filename.endsWith(".xml")).toBe(true);
    });

    it("defaults to .txt for txt/unknown", async () => {
        const filenameTxt = om.generateFilename({
            command: "extract",
            context: "x",
            format: "txt",
        });
        expect(filenameTxt.endsWith(".txt")).toBe(true);
    });
});
