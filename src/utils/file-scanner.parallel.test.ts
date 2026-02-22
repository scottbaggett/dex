import { describe, expect, test } from "bun:test";
import { FileScanner } from "./file-scanner.js";

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("FileScanner processInParallel", () => {
    test("respects max concurrency and preserves result order", async () => {
        const scanner = new FileScanner();
        const items = [1, 2, 3, 4, 5, 6];
        let inFlight = 0;
        let maxObserved = 0;

        const results = await (scanner as any).processInParallel(
            items,
            async (item: number) => {
                inFlight++;
                maxObserved = Math.max(maxObserved, inFlight);
                await sleep(10 + (item % 3));
                inFlight--;
                return item * 2;
            },
            2,
        );

        expect(maxObserved).toBeLessThanOrEqual(2);
        expect(results).toEqual([2, 4, 6, 8, 10, 12]);
    });

    test("normalizes non-positive concurrency to 1", async () => {
        const scanner = new FileScanner();
        const items = [1, 2, 3];
        let inFlight = 0;
        let maxObserved = 0;

        await (scanner as any).processInParallel(
            items,
            async (item: number) => {
                inFlight++;
                maxObserved = Math.max(maxObserved, inFlight);
                await sleep(5);
                inFlight--;
                return item;
            },
            0,
        );

        expect(maxObserved).toBe(1);
    });
});
