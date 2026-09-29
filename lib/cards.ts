// Splits generated HackMD into individual cards on their `---` frontmatter boundaries.

export type Card = {
  raw: string;
  title: string;
  cardType: string;
  duration: number | null;
  body: string;
};

const field = (fm: string, key: string) =>
  fm.match(new RegExp(`^${key}:[ \\t]*(.*)$`, "m"))?.[1].trim() ?? "";

/** Finds `---\n…card_type: …\n---` blocks. A bare `---` horizontal rule in a body is not a card start. */
function frontmatterStarts(text: string): { start: number; end: number; fm: string }[] {
  const out: { start: number; end: number; fm: string }[] = [];
  const re = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (/^card_type:/m.test(m[1])) out.push({ start: m.index, end: m.index + m[0].length, fm: m[1] });
    else re.lastIndex = m.index + 3; // that `---` was a rule; look again from just after it
  }
  return out;
}

/**
 * 0-based line indices of the `---` fences that open/close each card's frontmatter block — for
 * highlighting card boundaries in a raw editor. Mirrors frontmatterStarts' rule (a bare `---` only
 * counts once a `card_type:` line turns up before the next `---`) but works line-by-line instead of
 * on character offsets, since that's what a line-numbered editor gutter needs.
 */
export function frontmatterFenceLines(text: string): Set<number> {
  const lines = text.split("\n");
  const fenceLines = new Set<number>();
  let i = 0;
  while (i < lines.length) {
    if (lines[i].trim() === "---") {
      let j = i + 1;
      let hasCardType = false;
      while (j < lines.length && lines[j].trim() !== "---") {
        if (/^card_type:/.test(lines[j])) hasCardType = true;
        j++;
      }
      if (j < lines.length && hasCardType) {
        fenceLines.add(i);
        fenceLines.add(j);
        i = j + 1;
        continue;
      }
    }
    i++;
  }
  return fenceLines;
}

export type LineKind = "h1" | "h2" | "h3" | "media" | null;

/**
 * Per-line markup kind for tinting a raw editor: headings by level (H3–H6 share one tint) and
 * `<img`/`<iframe` lines. Lines inside ``` code fences are skipped, so a `# comment` in code
 * isn't mistaken for a heading.
 */
export function markupLineKinds(text: string): LineKind[] {
  let inFence = false;
  return text.split("\n").map((line) => {
    const t = line.trim();
    if (t.startsWith("```")) {
      inFence = !inFence;
      return null;
    }
    if (inFence) return null;
    const h = t.match(/^(#{1,6})\s+\S/);
    if (h) return h[1].length === 1 ? "h1" : h[1].length === 2 ? "h2" : "h3";
    if (/<(img|iframe)\b/i.test(t)) return "media";
    return null;
  });
}

/**
 * Some models wrap their whole reply in a single ```markdown ... ``` fence despite being told to
 * output raw markdown with no commentary — harmless in the model's own preview, but the literal
 * backticks then land in HackMD on copy/paste. Strip exactly one such wrapper, and only when it's
 * clearly the whole-reply kind: the first non-blank line is a bare opening fence (not `---`, which
 * every real cue card starts with) and the last non-blank line is a bare closing fence. A genuine
 * code block that happens to open the text — which shouldn't happen, since content starts with
 * frontmatter — would need a real close fence right at the very end too, on its own, to match this,
 * so a normal card's own ```python examples are never touched.
 */
export function stripOuterFence(text: string): string {
  const lines = text.split("\n");
  let start = 0;
  let end = lines.length - 1;
  while (start <= end && lines[start].trim() === "") start++;
  while (end >= start && lines[end].trim() === "") end--;
  if (start >= end) return text;

  const opens = /^```(?:markdown|md)?$/i.test(lines[start].trim());
  const closes = lines[end].trim() === "```";
  if (!opens || !closes) return text;

  const inner = lines.slice(start + 1, end).join("\n");
  return inner.trim() ? inner : text;
}

export const TABLE_STYLE = `<style>
table { border-collapse: collapse; }
table th, table td { border: 1px solid #94a3b8; padding: 6px 10px; }
table th { background:#1e3a8a; color:white; }
table td:nth-child(2) { font-weight:bold; }
</style>`;

/**
 * The table <style> block is a whole-file rule, but generation runs one section at a time — so the
 * model is told never to write it, and it's added here after the sections are merged: once, right
 * after the first card's closing `---` (anything before that `---` would break the first card's
 * frontmatter). Any <style> block the model wrote anyway is removed first. Files with no GFM table
 * (outside code fences) get none.
 */
export function addTableStyle(text: string): string {
  const stripped = text.replace(/\n*<style>[\s\S]*?<\/style>\n*/g, "\n\n");
  const outsideCode = stripped.replace(/^```[\s\S]*?^```/gm, "");
  const hasTable = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/m.test(outsideCode);
  const first = frontmatterStarts(stripped)[0];
  if (!hasTable || !first) return stripped;
  return stripped.slice(0, first.end) + "\n" + TABLE_STYLE + "\n\n" + stripped.slice(first.end).replace(/^\n+/, "");
}

export function splitCards(text: string): Card[] {
  const starts = frontmatterStarts(text);
  if (starts.length === 0) {
    return text.trim() ? [{ raw: text, title: "", cardType: "", duration: null, body: text.trim() }] : [];
  }
  return starts.map((s, i) => {
    // Anything before the first card (e.g. a deck-level `# Title`) rides along with card 1.
    const from = i === 0 ? 0 : s.start;
    const to = i + 1 < starts.length ? starts[i + 1].start : text.length;
    const dur = Number(field(s.fm, "duration"));
    return {
      raw: text.slice(from, to).trim() + "\n",
      title: field(s.fm, "title"),
      cardType: field(s.fm, "card_type"),
      duration: Number.isFinite(dur) && field(s.fm, "duration") !== "" ? dur : null,
      body: text.slice(s.end, to).trim(),
    };
  });
}
