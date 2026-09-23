// Deterministic, rule-based validator for the HackMD cue-card markdown format. No LLM calls —
// every check here is a plain string/regex rule, safe to run in the browser or on the server.
// Ported from the standalone Cue Card Validator tool so both places enforce identical rules.

export type Issue = { line: number; msg: string; hint?: string };

export type CardResult = {
  /** 1-based position among cards found in the file. */
  index: number;
  cardType: string;
  title: string;
  /** "L12–L34" for display. */
  loc: string;
  errors: Issue[];
  warnings: Issue[];
};

export type ValidationResult = {
  cardCount: number;
  /** Issues that belong to no card (stray "---", content before the first card). */
  docErrors: Issue[];
  cards: CardResult[];
  totalErrors: number;
  totalWarnings: number;
};

const KEYS = ["title", "description", "duration", "card_type"] as const;
const KNOWN = new Set<string>(KEYS);
const EMOJI = /\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]/gu;
const TITLE_OK = /[A-Za-z0-9 .+*/,?'"&()[\]\u2018\u2019\u201C\u201D:\-`\u2014]/g;

type CardSpan = { open: number; metaStart: number; metaEnd: number; close: number; bodyStart: number; bodyEnd: number };

const isDelim = (s: string) => s.trim() === "---";

function splitCardSpans(lines: string[]): CardSpan[] {
  const spans: Omit<CardSpan, "bodyEnd">[] = [];
  let i = 0;
  const n = lines.length;
  while (i < n) {
    if (isDelim(lines[i])) {
      let j = i + 1;
      let known = 0;
      while (j < n && !isDelim(lines[j]) && j - i <= 30) {
        const t = lines[j].trim();
        if (t !== "") {
          const ci = lines[j].indexOf(":");
          if (ci > -1 && KNOWN.has(lines[j].slice(0, ci).trim())) known++;
        }
        j++;
      }
      if (j < n && isDelim(lines[j]) && known >= 2) {
        spans.push({ open: i, metaStart: i + 1, metaEnd: j - 1, close: j, bodyStart: j + 1 });
        i = j + 1;
        continue;
      }
    }
    i++;
  }
  return spans.map((s, k) => ({ ...s, bodyEnd: k + 1 < spans.length ? spans[k + 1].open : n }));
}

function checkTextRules(value: string, ln: number, field: string, errors: Issue[]) {
  const em = value.match(EMOJI);
  if (em && em.length) {
    const u = [...new Set(em)].join(" ");
    errors.push({ line: ln, msg: `${field} contains emoji: ${u}`, hint: `Emojis are strictly not allowed in ${field}. Remove them.` });
  }
  if (value.includes(":")) {
    errors.push({ line: ln, msg: `${field} contains ":".`, hint: `Remove the colon — not allowed in ${field}.` });
  }
  if (/-{3,}|(?:-\s){2,}-/.test(value)) {
    errors.push({ line: ln, msg: `${field} contains "---".`, hint: "Remove the triple dashes — --- is only for metadata delimiters." });
  }
  const cleaned = value.replace(EMOJI, "").replace(/[️‍⃣]/g, "");
  const codeSpansStripped = cleaned.replace(/`[^`]*`/g, (m) => m.replace(/_/g, ""));
  const bad = codeSpansStripped.replace(TITLE_OK, "");
  if (bad.length) {
    const list = [...new Set(bad.split(""))].map((x) => (x === " " ? "space" : x)).join(" ");
    errors.push({
      line: ln,
      msg: `${field} has disallowed characters: ${list}`,
      hint:
        "Allowed: letters, digits, spaces, hyphens, em dashes (—), backtick-quoted code, and , ? ' \" & ( ) [ ]  — nothing else (no full stop, no emojis, underscores only inside backticks).",
    });
  }
}

function validateCard(lines: string[], c: CardSpan): { errors: Issue[]; warnings: Issue[]; cardType: string | null; title: string } {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  let cardType: string | null = null;
  let title = "";
  const seen: Record<string, { value: string; ln: number }> = {};

  for (let i = c.metaStart; i <= c.metaEnd; i++) {
    const raw = lines[i];
    const ln = i + 1;
    const t = raw.trim();
    if (t === "") {
      warnings.push({ line: ln, msg: "Blank line inside the metadata block.", hint: "Keep the 4 attributes on consecutive lines." });
      continue;
    }
    const ci = raw.indexOf(":");
    if (ci === -1) {
      errors.push({
        line: ln,
        msg: "Metadata line is not in \"key: value\" form.",
        hint: "A line with no \":\" usually means a value wrapped onto a new line — values must stay on one line.",
      });
      continue;
    }
    const left = raw.slice(0, ci);
    const right = raw.slice(ci + 1);
    const key = left.trim();
    const value = right.trim();
    if (/\s$/.test(left)) errors.push({ line: ln, msg: `Space before the ":" in "${key}".`, hint: `Write "${key}: value" with no space before the colon.` });
    if (right.length > 0 && !/^\s/.test(right)) errors.push({ line: ln, msg: `No space after the ":" in "${key}".`, hint: "Add one space after the colon." });
    if (!KNOWN.has(key)) {
      errors.push({ line: ln, msg: `Unknown metadata key "${key}".`, hint: "Only title, description, duration and card_type are allowed." });
      continue;
    }
    if (seen[key]) {
      errors.push({ line: ln, msg: `Duplicate metadata key "${key}".`, hint: "Each attribute may appear only once." });
      continue;
    }
    seen[key] = { value, ln };
  }

  for (const k of KEYS) {
    if (seen[k]) continue;
    if (k === "description") {
      warnings.push({ line: c.close + 1, msg: "description key is missing.", hint: "Optional — the key is conventionally included even with an empty value." });
    } else {
      errors.push({ line: c.close + 1, msg: `Missing required metadata key "${k}".`, hint: "title, duration and card_type are mandatory." });
    }
  }

  if (seen.title) {
    title = seen.title.value;
    const ln = seen.title.ln;
    if (title === "") errors.push({ line: ln, msg: "title is empty.", hint: "Provide a descriptive title." });
    else checkTextRules(title, ln, "title", errors);
  }
  if (seen.description) {
    const { value: val, ln } = seen.description;
    // An empty value is normal here, not an error: the "missing key" warning above already says
    // the key is conventionally kept even when empty — flagging that same state as an error too
    // would contradict it.
    if (val !== "") checkTextRules(val, ln, "description", errors);
  }
  if (seen.duration) {
    const { value, ln } = seen.duration;
    if (value === "") errors.push({ line: ln, msg: "duration has no value.", hint: "Always set a duration in seconds, e.g. 300." });
    else if (!/^\d+$/.test(value)) errors.push({ line: ln, msg: `duration "${value}" is not a whole number.`, hint: "Use seconds as a positive integer." });
    else if (parseInt(value, 10) <= 0) errors.push({ line: ln, msg: "duration must be greater than 0.", hint: "Set a realistic positive duration." });
  }
  if (seen.card_type) {
    const { value, ln } = seen.card_type;
    if (value === "cue_card" || value === "quiz_card") cardType = value;
    else errors.push({ line: ln, msg: `card_type "${value}" is invalid.`, hint: "Must be exactly cue_card or quiz_card." });
  }

  const bs = c.bodyStart;
  const be = c.bodyEnd;
  const body = lines.slice(bs, be);
  const G = (idx: number) => bs + idx + 1;
  const bodyText = body.join("\n").trim();
  const headRe = /^#{1,6}\s+\S/;

  if (cardType === "cue_card") {
    if (bodyText === "") errors.push({ line: c.close + 2, msg: "Cue card has no content after the metadata.", hint: "Add the markdown body for this card." });
    else if (!body.some((l) => headRe.test(l.trim())))
      warnings.push({ line: c.close + 2, msg: "Cue card body has no markdown heading.", hint: "Start the content with a \"# Heading\" matching the title." });
  }

  if (cardType === "quiz_card") {
    let qIdx = -1;
    let cIdx = -1;
    for (let i = 0; i < body.length; i++) {
      const t = body[i].trim();
      if (/^#\s+Question\s*$/.test(t) && qIdx === -1) qIdx = i;
      if (/^#\s+Choices\s*$/.test(t) && cIdx === -1) cIdx = i;
    }
    if (qIdx === -1) errors.push({ line: c.close + 2, msg: "Quiz card is missing the \"# Question\" heading.", hint: "Add \"# Question\" with the question below it." });
    if (cIdx === -1) errors.push({ line: c.close + 2, msg: "Quiz card is missing the \"# Choices\" heading.", hint: "Add \"# Choices\" with the checklist below it." });

    if (qIdx !== -1) {
      let end = body.length;
      for (let i = qIdx + 1; i < body.length; i++) {
        if (headRe.test(body[i].trim())) {
          end = i;
          break;
        }
      }
      if (body.slice(qIdx + 1, end).join("\n").trim() === "")
        errors.push({ line: G(qIdx), msg: "\"# Question\" has no content below it.", hint: "Write the question text under the heading." });
    }

    if (cIdx !== -1) {
      const reC = /^\s*-\s*\[([ xX])\]\s*(.*)$/;
      let lower = 0;
      let total = 0;
      let lastChoice = -1;
      for (let i = cIdx + 1; i < body.length; i++) {
        if (headRe.test(body[i].trim())) break;
        const m = body[i].match(reC);
        if (m) {
          total++;
          lastChoice = i;
          if (m[1] === "x") lower++;
          else if (m[1] === "X")
            errors.push({ line: G(i), msg: "Choice uses capital \"[X]\".", hint: "Mark the correct answer with a lowercase x — capital X throws an error." });
          if (m[2].trim() === "") warnings.push({ line: G(i), msg: "A choice has no text.", hint: "Add the option text after the checkbox." });
        }
      }
      if (total === 0) errors.push({ line: G(cIdx), msg: "No checklist choices found under \"# Choices\".", hint: "Add choices as \"- [ ] option\" lines." });
      else {
        if (total < 2) errors.push({ line: G(cIdx), msg: `Only ${total} choice found — at least 2 required.`, hint: "Add more options." });
        if (lower === 0) errors.push({ line: G(cIdx), msg: "No correct answer marked.", hint: "Mark exactly one choice with lowercase \"[x]\"." });
        else if (lower > 1) errors.push({ line: G(cIdx), msg: `${lower} choices marked correct — exactly one allowed.`, hint: "Leave only one \"[x]\"." });
      }

      if (lastChoice !== -1) {
        for (let i = lastChoice + 1; i < body.length; i++) {
          if (body[i].trim() !== "") {
            errors.push({
              line: G(i),
              msg: "No cue card for content.",
              hint:
                "A quiz card ends at its choices — content after this point has no cue card above it, so it is dropped on ingestion and is NOT visible to the instructor. Move it into its own cue card, or remove it.",
            });
            break;
          }
        }
      }
    }
  }

  let fenceOpen = false;
  for (let i = 0; i < body.length; i++) {
    const m = body[i].match(/^\s*```([^\s`]*)\s*$/);
    if (m) {
      if (!fenceOpen) {
        const info = m[1];
        if (info === "") warnings.push({ line: G(i), msg: "Code fence has no language.", hint: "Use the ```lang= form, e.g. ```sql=" });
        else if (!info.endsWith("=")) warnings.push({ line: G(i), msg: `Code fence \`\`\`${info} should end with "=".`, hint: `Guidelines use the \`\`\`${info}= fence form.` });
      }
      fenceOpen = !fenceOpen;
    }
  }

  return { errors, warnings, cardType, title };
}

function classifyStray(lines: string[], i: number): [string, string] {
  let known = 0;
  let closed = false;
  for (let j = i + 1; j < lines.length && j - i <= 30; j++) {
    if (lines[j].trim() === "---") {
      closed = true;
      break;
    }
    const t = lines[j].trim();
    if (t !== "") {
      const ci = lines[j].indexOf(":");
      if (ci > -1 && KNOWN.has(lines[j].slice(0, ci).trim())) known++;
    }
  }
  if (known >= 2 && !closed)
    return ["Metadata block opened with \"---\" but never closed.", "Every opening --- needs a matching closing --- after the 4 attributes."];
  return ["Stray \"---\" outside a card metadata block.", "--- may only be a card's opening or closing metadata delimiter. Remove it, or wrap the surrounding content in its own card."];
}

/** Validates a whole HackMD file (one or many cards). Pure function, no I/O, no LLM calls. */
export function validateMarkdown(text: string): ValidationResult {
  const lines = text.split(/\r?\n/);
  const spans = splitCardSpans(lines);
  const results = spans.map((c) => ({ ...validateCard(lines, c), open: c.open, bodyEnd: c.bodyEnd }));

  const delim = new Set<number>();
  spans.forEach((c) => {
    delim.add(c.open);
    delim.add(c.close);
  });
  const docErrors: Issue[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "---" && !delim.has(i)) {
      const [msg, hint] = classifyStray(lines, i);
      const ci = spans.findIndex((c) => i >= c.open && i < c.bodyEnd);
      if (ci > -1) results[ci].errors.push({ line: i + 1, msg, hint });
      else docErrors.push({ line: i + 1, msg, hint });
    }
  }

  if (spans.length === 0 && docErrors.length === 0) {
    docErrors.push({ line: 1, msg: "No card metadata block detected.", hint: "Each card must start with --- , list its attributes, then close with --- ." });
  }

  if (spans.length > 0) {
    // A leading `<style>...</style>` block (the file-wide table CSS — see the SOP's "How to add
    // tables in Markdown") belongs before the first card, not inside one. Skip it before checking
    // for genuinely orphaned content, so following that convention isn't itself flagged as an error.
    let i = 0;
    while (i < spans[0].open && lines[i].trim() === "") i++;
    if (lines[i]?.trim() === "<style>") {
      while (i < spans[0].open && lines[i].trim() !== "</style>") i++;
      if (lines[i]?.trim() === "</style>") i++;
    }
    for (; i < spans[0].open; i++) {
      if (lines[i].trim() !== "") {
        docErrors.push({
          line: i + 1,
          msg: "No cue card for content.",
          hint: "Content must live inside a cue card. Wrap this in its own cue_card, or move it below one.",
        });
        break;
      }
    }
  }

  const cards: CardResult[] = results.map((r, k) => ({
    index: k + 1,
    cardType: r.cardType ?? "unknown",
    title: r.title || "(no title)",
    loc: `L${r.open + 1}–L${r.bodyEnd}`,
    errors: r.errors.slice().sort((a, b) => a.line - b.line),
    warnings: r.warnings.slice().sort((a, b) => a.line - b.line),
  }));

  const totalErrors = cards.reduce((s, c) => s + c.errors.length, 0) + docErrors.length;
  const totalWarnings = cards.reduce((s, c) => s + c.warnings.length, 0);

  return { cardCount: spans.length, docErrors, cards, totalErrors, totalWarnings };
}
