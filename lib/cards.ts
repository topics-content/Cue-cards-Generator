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
