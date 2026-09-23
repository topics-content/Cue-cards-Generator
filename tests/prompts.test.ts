import { describe, expect, it } from "vitest";
import { pass1Prompt, pass2Prompt } from "@/lib/prompts";

describe("wording-fidelity rule", () => {
  it("is the first thing in pass 1, ahead of everything else including continuity", () => {
    const p = pass1Prompt({ className: "C", index: 1, total: 3, section: "text", summary: "prior" });
    expect(p.indexOf("CRITICAL — do not reword")).toBe(0);
    expect(p.indexOf("CRITICAL")).toBeLessThan(p.indexOf("<previous>"));
    expect(p.indexOf("CRITICAL")).toBeLessThan(p.indexOf("<script_section>"));
    expect(p).toMatch(/do not paraphrase, summarize/i);
  });

  it("is also first in pass 2, and the audit explicitly reverts reworded text to the source", () => {
    const p = pass2Prompt({ section: "src", draft: "draft" });
    expect(p.indexOf("CRITICAL — do not reword")).toBe(0);
    expect(p).toMatch(/restore the source's exact wording/i);
  });

  it("still allows structural changes: headings, bullets, splitting into cards", () => {
    const p = pass1Prompt({ className: "C", index: 0, total: 1, section: "text" });
    expect(p).toMatch(/only changes allowed are structural/i);
  });
});
