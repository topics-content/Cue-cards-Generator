import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { splitSections } from "@/lib/chunk";
import { parseNotebook } from "@/lib/parsers/ipynb";

describe("splitSections", () => {
  it("splits at # and ## headings, not ###", () => {
    const text = "# A\n" + "a\n".repeat(30) + "## B\n" + "b\n".repeat(30) + "### C\nc\n";
    const s = splitSections(text, 100, 10);
    expect(s).toHaveLength(2);
    expect(s[1].startsWith("## B")).toBe(true);
    expect(s[1]).toContain("### C");
  });

  it("does not split on # comments inside code fences", () => {
    const text = "# A\n" + "x\n".repeat(20) + "```python\n# not a heading\nprint(1)\n```\n" + "# B\nb\n";
    const s = splitSections(text, 60, 10);
    expect(s.some((sec) => sec.startsWith("# not a heading"))).toBe(false);
    expect(s.find((sec) => sec.includes("# not a heading"))).toContain("```python");
  });

  it("merges tiny neighbouring sections", () => {
    const s = splitSections("# A\na\n# B\nb\n# C\nc\n", 1000, 100);
    expect(s).toHaveLength(1);
  });

  it("breaks oversized sections and respects the max", () => {
    const para = "word ".repeat(40) + "\n\n";
    const text = "# Big\n" + para.repeat(30);
    const s = splitSections(text, 1000, 200);
    expect(s.length).toBeGreaterThan(1);
    for (const sec of s) expect(sec.length).toBeLessThanOrEqual(1000);
  });

  it("hard-splits a single line longer than max", () => {
    const s = splitSections("x".repeat(2500), 1000, 100);
    expect(s.every((x) => x.length <= 1000)).toBe(true);
  });

  it("never loses or reorders text", () => {
    const nb = parseNotebook(readFileSync("tests/fixtures/real-notebook.ipynb", "utf8")).text;
    const s = splitSections(nb);
    expect(s.join("")).toBe(nb);
    expect(s.length).toBeGreaterThan(1);
    for (const sec of s) expect(sec.length).toBeLessThanOrEqual(16_000);
  });
});
