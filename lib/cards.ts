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

const TABLE_SEPARATOR = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/;

/**
 * Every table gets its own <style> block directly above it. One block for the whole file would be
 * enough CSS, but a card is routinely read and copied on its own — OutputView renders each card in
 * its own box with a per-card Copy button — so a block sitting in card 1 leaves every other table
 * unstyled wherever it actually gets pasted. Generation runs one section at a time and the model is
 * told never to write the block, so any <style> it wrote anyway is stripped first. A block is never
 * placed before the first card's opening `---`: anything there stops that `---` being read as the
 * frontmatter delimiter (lib/validateCards.ts flags it). Files with no GFM table get none.
 */
export function addTableStyle(text: string): string {
  const stripped = text.replace(/\n*<style>[\s\S]*?<\/style>\n*/g, "\n\n");
  const first = frontmatterStarts(stripped)[0];
  if (!first) return stripped;

  const lines = stripped.split("\n");
  const bodyStart = stripped.slice(0, first.end).split("\n").length - 1;
  const out: string[] = [];
  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith("```")) inFence = !inFence;
    // A table starts at its header row — the line directly above the `---|---` separator.
    const startsTable =
      !inFence && i >= bodyStart && lines[i].includes("|") && i + 1 < lines.length && TABLE_SEPARATOR.test(lines[i + 1]);
    if (startsTable) {
      if (out.length && out[out.length - 1].trim() !== "") out.push("");
      out.push(TABLE_STYLE);
    }
    out.push(lines[i]);
  }
  return out.join("\n");
}

const normalizeHeading = (s: string) => s.replace(/<[^>]*>/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

function sourceH2s(source: string): Set<string> {
  const out = new Set<string>();
  let inFence = false;
  for (const line of source.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    const m = !inFence && line.match(/^##\s+(.+?)\s*#*\s*$/);
    if (m) {
      const n = normalizeHeading(m[1]);
      if (n) out.add(n);
    }
  }
  return out;
}

function demoteHeadings(body: string): string {
  let inFence = false;
  return body
    .split("\n")
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
      const m = !inFence && line.match(/^(#{1,5})(\s.*)$/);
      return m ? "#" + m[1] + m[2] : line;
    })
    .join("\n");
}

/**
 * Structure only — never touches a card's words. Every card should line up with a `##` heading in
 * the source script (matched on the card's title, or failing that its opening body heading, ignoring
 * case and punctuation). A card that doesn't is folded into the nearest card above it that isn't a
 * quiz or a "Quiz N Explanation" (so a section after a quiz joins its parent section's card, ahead of
 * the quiz in reading order): its heading stays as an H3, its own headings move one level down,
 * durations add up and its description is dropped. Quiz cards, "Quiz N Explanation", Agenda and
 * Unlock Assignment have no `##` of their own and are left alone, and the first card never merges. A
 * source with no `##` headings is returned unchanged.
 */
export function alignCardsToHeadings(text: string, source: string): string {
  const h2s = sourceH2s(source);
  const starts = frontmatterStarts(text);
  if (h2s.size === 0 || starts.length < 2) return text;

  type Part = { head: string; fm: string; body: string };
  const parts: Part[] = starts.map((s, i) => ({
    head: text.slice(s.start, s.end),
    fm: s.fm,
    body: text.slice(s.end, i + 1 < starts.length ? starts[i + 1].start : text.length),
  }));

  const isQuiz = (p: Part) => field(p.fm, "card_type") === "quiz_card";
  const isExplanation = (p: Part) => /^quiz\s*\d+\s*explanation$/i.test(field(p.fm, "title"));
  const firstHeading = (p: Part) => p.body.match(/^\s*#{1,6}\s+(\S.*)$/m)?.[1] ?? "";
  const isAligned = (p: Part) => {
    const title = field(p.fm, "title");
    if (isQuiz(p) || /^quiz\s*\d+\s*explanation$/i.test(title) || /^unlock assignment/i.test(title) || normalizeHeading(title) === "agenda") return true;
    return h2s.has(normalizeHeading(title)) || h2s.has(normalizeHeading(firstHeading(p)));
  };

  const kept: Part[] = [parts[0]];
  for (const p of parts.slice(1)) {
    if (isAligned(p)) {
      kept.push(p);
      continue;
    }
    let target = kept.length - 1;
    while (target >= 0 && (isQuiz(kept[target]) || isExplanation(kept[target]))) target--;
    if (target < 0) {
      kept.push(p);
      continue;
    }
    const above = kept[target];
    const opensWithHeading = /^\s*#{1,6}\s+\S/.test(p.body);
    const body = demoteHeadings(p.body).trim();
    const added = opensWithHeading ? body : `### ${field(p.fm, "title")}\n\n${body}`;
    const gap = p.body.match(/\s*$/)?.[0] ?? "";
    above.body = above.body.replace(/\s+$/, "") + "\n\n" + added + gap;

    const a = field(above.fm, "duration");
    const b = field(p.fm, "duration");
    if (a !== "" && b !== "" && Number.isFinite(Number(a)) && Number.isFinite(Number(b))) {
      const total = String(Number(a) + Number(b));
      above.head = above.head.replace(/^duration:[ \t]*.*$/m, `duration: ${total}`);
      above.fm = above.fm.replace(/^duration:[ \t]*.*$/m, `duration: ${total}`);
    }
  }
  return text.slice(0, starts[0].start) + kept.map((p) => p.head + p.body).join("");
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
