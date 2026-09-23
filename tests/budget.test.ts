import { describe, expect, it } from "vitest";
import { capAt, nextCapAfter, parseTiers } from "@/lib/budget";

describe("budget tiers", () => {
  it("defaults to 3, 5 (5 is the maximum)", () => {
    expect(parseTiers(3, undefined)).toEqual([3, 5]);
  });
  it("reads configured steps", () => {
    expect(parseTiers(2, "4, 6, 8")).toEqual([2, 4, 6, 8]);
  });
  it("ignores junk and non-increasing steps", () => {
    expect(parseTiers(3, "abc,-1")).toEqual([3]);
    expect(parseTiers(3, "7,5")).toEqual([3]);
    expect(parseTiers(5, "3,7")).toEqual([5]);
  });
  it("walks the tiers and never goes past the maximum", () => {
    const t = [3, 5, 7];
    expect([0, 1, 2].map((i) => capAt(t, i))).toEqual([3, 5, 7]);
    expect(capAt(t, 9)).toBe(7);
    expect(capAt(t, -1)).toBe(3);
    expect(nextCapAfter(t, 0)).toBe(5);
    expect(nextCapAfter(t, 1)).toBe(7);
    expect(nextCapAfter(t, 2)).toBeNull();
  });
});
