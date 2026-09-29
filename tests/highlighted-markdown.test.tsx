import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HighlightedMarkdown } from "@/components/HighlightedMarkdown";

const html = (md: string) => renderToStaticMarkup(<HighlightedMarkdown text={md} />);

describe("HighlightedMarkdown", () => {
  it("colours headings, bold, inline code and links with their own classes", () => {
    const out = html("## Heading\n\n**bold** and `code` and [a link](https://example.com)");
    expect(out).toContain('class="md-hl-heading"');
    expect(out).toContain('class="md-hl-strong"');
    expect(out).toContain('class="md-hl-code"');
    expect(out).toContain('class="md-hl-link"');
    // The actual characters still show up untouched — this only adds colour, never rewrites text.
    expect(out).toContain("Heading");
    expect(out).toContain("bold");
    expect(out).toContain("code");
  });

  it("colours an SOP-style HTML span's tag, attribute and value", () => {
    const out = html('<span style="background-color: red;color: White;">Instructor Note:</span>');
    expect(out).toContain('class="md-hl-tag"');
    expect(out).toContain('class="md-hl-attr"');
    expect(out).toContain('class="md-hl-value"');
    expect(out).toContain("Instructor Note:");
  });

  it("keeps line breaks so multi-line cue cards still read top to bottom", () => {
    const out = html("---\ntitle: One\n---\n\n## Body");
    // Rendered as literal newlines inside <pre>, not <br>, so a plain-text diff still lines up.
    expect(out.replace(/<[^>]+>/g, "")).toContain("title: One\n---");
  });

  it("does not throw on malformed or empty markdown", () => {
    expect(() => html("")).not.toThrow();
    expect(() => html("<span unterminated")).not.toThrow();
    expect(() => html("```\nunclosed fence")).not.toThrow();
  });
});
