import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseNotebook } from "@/lib/parsers/ipynb";

const real = readFileSync("tests/fixtures/real-notebook.ipynb", "utf8");

describe("parseNotebook on a real notebook (~850 KB)", () => {
  const { text, imageCount } = parseNotebook(real);

  it("is over 800 KB going in and well under 60k chars coming out", () => {
    expect(real.length).toBeGreaterThan(800_000);
    expect(text.length).toBeLessThan(60_000);
  });

  it("replaces every image output with a numbered placeholder", () => {
    const nb = JSON.parse(real);
    const images = nb.cells
      .flatMap((c: any) => c.outputs ?? [])
      .filter((o: any) => Object.keys(o.data ?? {}).some((k) => k.startsWith("image/"))).length;
    expect(images).toBeGreaterThan(0);
    expect(imageCount).toBe(images);
    for (let n = 1; n <= images; n++) expect(text).toContain(`![plot-${n}](image-placeholder)`);
  });

  it("leaks no base64", () => {
    expect(text).not.toMatch(/base64/i);
    expect(text).not.toMatch(/[A-Za-z0-9+/]{200,}/);
    expect(text).not.toContain("iVBORw0KGgo"); // PNG magic number in base64
  });

  it("keeps markdown, code and text outputs", () => {
    expect(text).toContain("```python");
    expect(text).toMatch(/^#{1,3} /m);
    expect(text).toContain("Output:");
  });
});

describe("parseNotebook edge cases", () => {
  it("strips base64 hidden in markdown source", () => {
    const nb = {
      cells: [{ cell_type: "markdown", source: ["![x](data:image/png;base64,", "A".repeat(600), ")"] }],
    };
    const { text } = parseNotebook(JSON.stringify(nb));
    expect(text).not.toContain("AAAA");
    expect(text).toContain("image-placeholder");
  });

  it("rejects non-notebook input with a readable error", () => {
    expect(() => parseNotebook("not json")).toThrow(/not valid notebook JSON/);
    expect(() => parseNotebook("{}")).toThrow(/No cells/);
  });
});
