import { describe, expect, it } from "vitest";
import { runWithConcurrency } from "@/lib/concurrency";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("runWithConcurrency", () => {
  it("runs every item exactly once, in an arbitrary order", async () => {
    const seen: number[] = [];
    await runWithConcurrency(10, 3, async (i) => {
      await sleep(Math.random() * 5);
      seen.push(i);
    });
    expect(seen.slice().sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(new Set(seen).size).toBe(10); // no duplicates
  });

  it("never runs more than `limit` at once", async () => {
    let inFlight = 0;
    let max = 0;
    await runWithConcurrency(9, 3, async () => {
      inFlight++;
      max = Math.max(max, inFlight);
      await sleep(5);
      inFlight--;
    });
    expect(max).toBeLessThanOrEqual(3);
    expect(max).toBe(3); // with 9 items and slower-than-dispatch work, it should actually reach the cap
  });

  it("clamps the concurrency to n when limit is larger than the item count", async () => {
    let max = 0;
    let inFlight = 0;
    await runWithConcurrency(2, 10, async () => {
      inFlight++;
      max = Math.max(max, inFlight);
      await sleep(5);
      inFlight--;
    });
    expect(max).toBe(2);
  });

  it("refills a slot as soon as a fast item finishes, not in fixed batches", async () => {
    const order: number[] = [];
    // item 0 is slow, items 1-3 are fast: with concurrency 2, item 2 should start (in slot 1)
    // right after item 1 finishes, well before item 0's slow slot frees up.
    await runWithConcurrency(4, 2, async (i) => {
      await sleep(i === 0 ? 30 : 5);
      order.push(i);
    });
    expect(order.indexOf(0)).toBeGreaterThan(order.indexOf(1));
    expect(order.indexOf(0)).toBeGreaterThan(order.indexOf(2));
  });

  it("stops starting new items once shouldStop is true, but still awaits in-flight ones", async () => {
    const started: number[] = [];
    const finished: number[] = [];
    let stop = false;
    await runWithConcurrency(
      6,
      2,
      async (i) => {
        started.push(i);
        if (i === 1) stop = true; // flip mid-run
        await sleep(10);
        finished.push(i);
      },
      () => stop,
    );
    // The two items already dispatched before `stop` flipped still ran to completion...
    expect(finished).toEqual(expect.arrayContaining(started));
    // ...but not everything was started.
    expect(started.length).toBeLessThan(6);
  });

  it("handles n = 0 without hanging", async () => {
    let calls = 0;
    await runWithConcurrency(0, 3, async () => {
      calls++;
    });
    expect(calls).toBe(0);
  });

  it("a worker's rejection propagates without corrupting which items already ran", async () => {
    const seen: number[] = [];
    await expect(
      runWithConcurrency(5, 2, async (i) => {
        seen.push(i);
        if (i === 2) throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(seen.length).toBeGreaterThan(0);
  });
});
