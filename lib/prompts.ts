// Task framing only. The SOP rules and the example pair live in lib/sop/ and are yours to write.
// Both passes share the same system prefix so the second pass reads it from cache.

// Placed first in every pass, and repeated in the audit's checklist, because a model instruction
// buried after other rules gets followed less reliably than one stated up front and reinforced.
const FIDELITY_RULE = `CRITICAL — do not reword the script:
- Carry over explanations, definitions, statements, and code exactly as written in <script_section> — same words, same order, same meaning.
- Do NOT paraphrase, summarize, shorten for style, "clean up" phrasing, add explanation the source doesn't contain, or drop stated detail.
- The only changes allowed are structural: splitting the text into cue cards, adding headings/bullets/frontmatter/actionable formatting per the SOP, and fixing an isolated spelling typo without rephrasing the sentence it's in.
- If a sentence could be kept as-is or improved, keep it as-is.`;

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

export function pass2Prompt(o: { section: string; draft: string; summary?: string }): string {
  const continuity = o.summary
    ? `Continuity from the earlier sections:\n<previous>\n${o.summary}\n</previous>\n\n`
    : "";
  return (
    `${FIDELITY_RULE}\n\n` +
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
    `counterpart in the draft; don't rely on skimming for what looks missing. ` +
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
