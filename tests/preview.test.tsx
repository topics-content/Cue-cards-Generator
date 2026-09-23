import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownPreview } from "@/components/MarkdownPreview";

const html = (md: string) => renderToStaticMarkup(<MarkdownPreview markdown={md} />);

describe("MarkdownPreview", () => {
  it("applies the colour spans the SOP uses", () => {
    const out = html('<span style="background-color: red;">Note for instructor</span> and <font color="green">ok</font>');
    expect(out).toContain("background-color:red");
    expect(out).toContain('color="green"');
  });

  it("renders GFM tables, lists and code", () => {
    const out = html("| a | b |\n|---|---|\n| 1 | 2 |\n\n- x\n\n```sql=\nselect 1\n```");
    expect(out).toContain("<table>");
    expect(out).toContain("<li>x</li>");
    expect(out).toContain("<pre>");
  });

  it("strips scripts, event handlers and iframes", () => {
    const out = html('<script>alert(1)</script><img src="x" onerror="alert(1)"><iframe src="https://evil.test"></iframe>');
    expect(out).not.toMatch(/<script|onerror|<iframe/i);
  });

  it("does not emit javascript: hrefs", () => {
    expect(html("[x](javascript:alert(1))")).not.toMatch(/href="javascript:/i);
    expect(html('<a href="javascript:alert(1)">x</a>')).not.toMatch(/href="javascript:/i);
  });

  it("keeps only colour declarations in inline styles", () => {
    const out = html('<span style="position:fixed;top:0;color:red;background:url(x)">hi</span>');
    expect(out).toContain("color:red");
    expect(out).not.toMatch(/position|top:0|url\(/);
  });
});
