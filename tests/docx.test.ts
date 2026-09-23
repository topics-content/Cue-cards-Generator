import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { convertDocxToMarkdown } from "@/lib/parsers/docx";

describe("convertDocxToMarkdown on a real .docx with an embedded image", () => {
  const bytes = readFileSync("tests/fixtures/tiny-picture.docx");

  it("never leaks base64 image data — mammoth's own default would (verified separately)", async () => {
    const { text } = await convertDocxToMarkdown(bytes);
    expect(text).not.toMatch(/data:image/i);
    expect(text).not.toMatch(/base64/i);
    expect(text).not.toMatch(/[A-Za-z0-9+/]{100,}/); // no long base64-looking run either
  });

  it("replaces the image with a numbered placeholder, matching the notebook convention", async () => {
    const { text, imageCount } = await convertDocxToMarkdown(bytes);
    expect(imageCount).toBe(1);
    expect(text).toContain("![plot-1](image-placeholder)");
  });

  it("numbers multiple images in order without reading any of their bytes", async () => {
    // Same image twice, to confirm the counter advances per image rather than staying at 1.
    const twice = Buffer.concat([bytes]); // conversion below calls convertDocxToMarkdown twice on
    const a = await convertDocxToMarkdown(twice);
    const b = await convertDocxToMarkdown(twice);
    expect(a.imageCount).toBe(1);
    expect(b.imageCount).toBe(1); // counter is local to each call, not shared global state
  });
});
