// Task framing only. The SOP rules and the example pair live in lib/sop/ and are yours to write.
// Both passes share the same system prefix so the second pass reads it from cache.

// Placed first in every pass, and repeated in the audit's checklist, because a model instruction
// buried after other rules gets followed less reliably than one stated up front and reinforced.
const FIDELITY_RULE = `CRITICAL — do not reword the script:
- Carry over explanations, definitions, statements, and code exactly as written in <script_section> — same words, same order, same meaning.
- Do NOT paraphrase, summarize, shorten for style, "clean up" phrasing, add explanation the source doesn't contain, or drop stated detail.
- The only changes allowed are structural: splitting the text into cue cards, adding headings/bullets/frontmatter/actionable formatting per the SOP, and fixing an isolated spelling typo without rephrasing the sentence it's in.
- If a sentence could be kept as-is or improved, keep it as-is.
- Code, URLs, LaTeX and identifiers (table, column, function and file names) are copied byte-for-byte. Typo fixes never apply inside them. Wrapping code and identifiers in single backticks is allowed (and required for inline code and underscore words, per the SOP); the text inside stays unchanged. LaTeX is never wrapped in backticks.
- A source heading's own wording must still appear somewhere in the output — as the card's body H2, or folded into a nearby line — even when the card's title: metadata uses different, more descriptive wording per the SOP. Giving a card a better title is not permission for the source heading's own words to vanish with no trace. The only exception is the SOP's "Lines that are dropped" list (lecture header, program line, hour banners, timing lines, document-export leftovers) — those are dropped, and timings go into duration.
- The only image URLs allowed are ones in the source, the SOP's fixed placeholder URL, and the Unlock template's own two.
- Never state the same piece of content twice. Carrying content over means moving it to exactly one place, not copying it into more than one card or heading — restructuring is not an excuse to repeat something.`;

export function pass1Prompt(o: {
  className: string;
  index: number;
  total: number;
  section: string;
  summary?: string;
}): string {
  const continuity = o.summary
    ? `Continuity from the earlier sections. Do not repeat it; continue numbering and cross-references from it:\n<previous>\n${o.summary}\n</previous>\n\n`
    : "";
  return (
    `${FIDELITY_RULE}\n\n` +
    `This is section ${o.index + 1} of ${o.total} of the lecture script "${o.className}".\n\n` +
    continuity +
    `<script_section>\n${o.section}\n</script_section>\n\n` +
    `Generate the HackMD cue cards for this section, following the SOP and the golden example. ` +
    `Output only the HackMD markdown, starting directly with the first card's `+ "`---`" + ` frontmatter. ` +
    `Do not wrap your reply in a \`\`\`markdown or \`\`\` code fence — that fence is not part of the cue cards ` +
    `and breaks copy-pasting into HackMD. Code fences belong only inside a card, around actual code.`
  );
}

export function pass2Prompt(o: { index: number; total: number; section: string; draft: string; summary?: string }): string {
  const continuity = o.summary
    ? `Continuity from the earlier sections:\n<previous>\n${o.summary}\n</previous>\n\n`
    : "";
  return (
    `${FIDELITY_RULE}\n\n` +
    `This is section ${o.index + 1} of ${o.total}.\n\n` +
    continuity +
    `<source_section>\n${o.section}\n</source_section>\n\n` +
    `<draft>\n${o.draft}\n</draft>\n\n` +
    `Audit the draft against every rule in the SOP, checking it against the source section. ` +
    `In particular, find every place the draft reworded, paraphrased, shortened, or changed the meaning of ` +
    `something the source said, and restore the source's exact wording there — keep only structural formatting. ` +
    `Separately, find every place the draft added a line, sentence, or explanation with no counterpart in ` +
    `<source_section> at all — not a reworded version of something the source said, but new content the ` +
    `source never said — and delete it; a card may end up shorter than the draft if the draft invented content. ` +
    `Separately again, find anything the source states that the draft dropped with no trace at all — not ` +
    `reworded, not shortened, just missing — including bracketed instructor cues like [WAIT FOR ANSWERS] or ` +
    `[REVEAL ANSWER], stage directions, and asides; add it back word-for-word in the right place, even if it ` +
    `doesn't match one of the SOP's named formatting categories — an unlisted cue stays in as plain text ` +
    `rather than being silently cut. Go line by line through the source section checking each statement has a ` +
    `counterpart in the draft; don't rely on skimming for what looks missing. This includes the source's own ` +
    `headings: if a card's title is more descriptive than the heading that introduced that content in ` +
    `<source_section>, confirm the heading's own words still show up somewhere in the card (as an H2, or ` +
    `folded into a line) — a heading being replaced by a better title is not the same as its words being kept, ` +
    `and it must not simply disappear — except the SOP's "Lines that are dropped" list, which stays dropped. ` +
    `Separately, check every code block, URL and formula is identical to the source, character for character ` +
    `(added backticks aside; LaTeX must stay LaTeX, never backticked) — restore any that differ, ` +
    `even by a single space or symbol, and make sure no math symbol is left as bare text. ` +
    `Check each quiz question and choice matches the source exactly, punctuation included. ` +
    `Check that each quiz with a stated answer has exactly one [x] and an explanation card opening with ` +
    `**Correct Answer:** and the option text, without the letter. ` +
    `Replace any other image URL with the SOP's placeholder URL, and make sure no source image was dropped. ` +
    `Check every source table appears as a GFM table with all its rows and columns — never as an image or a list. ` +
    `Separately, check for content stated more than once — the same sentence, code block, heading, or bullet ` +
    `appearing in two places in the draft; keep the one copy in the right place and delete the rest. ` +
    `Also check the SOP's Unlock Assignment card appears only where the source section has an ` +
    `unlock-assignment part, and isn't missing where it does. ` +
    `Output only the corrected HackMD markdown, with no commentary, starting directly with the first ` +
    `card's ` + "`---`" + ` frontmatter. Do not wrap your reply in a \`\`\`markdown or \`\`\` code fence, ` +
    `even if the draft above has one — remove it. Code fences belong only inside a card, around actual code.`
  );
}

/**
 * Deterministic running summary carried between sections (no extra LLM call):
 * how many sections are done, plus the tail of the latest output so numbering continues.
 */
export function runningSummary(completedSections: string[]): string {
  if (completedSections.length === 0) return "";
  const last = completedSections[completedSections.length - 1].trimEnd();
  return `${completedSections.length} section(s) already done. The last section's output ended with:\n${last.slice(-1200)}`;
}
