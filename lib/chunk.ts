// Splits a parsed script into sections that each fit comfortably inside one API-route call.
// Invariant: sections.join("") === input (nothing is lost or reordered).

export const MAX_SECTION_CHARS = 16_000;
export const MIN_SECTION_CHARS = 2_000;

const HEADING = /^#{1,2}\s/;
const FENCE = /^\s*(```|~~~)/;

/** Split into lines (keeping newlines) and cut before each #/## heading that is outside a code fence. */
function splitAtHeadings(text: string): string[] {
  const blocks: string[] = [];
  let cur = "";
  let inFence = false;
  for (const line of text.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
    if (FENCE.test(line)) inFence = !inFence;
    if (!inFence && HEADING.test(line) && cur) {
      blocks.push(cur);
      cur = "";
    }
    cur += line;
  }
  if (cur) blocks.push(cur);
  return blocks;
}

/**
 * Break an oversized block at blank lines outside code fences. If the size limit is hit inside a
 * fence, cut before the fence opens so it stays whole; only a fence bigger than max is cut inside.
 */
function splitOversized(block: string, max: number): string[] {
  const pieces: string[] = [];
  let cur = "";
  let inFence = false;
  let fenceStart = 0; // index in `cur` where the open fence began
  const flush = () => {
    if (cur) pieces.push(cur);
    cur = "";
    fenceStart = 0;
  };
  for (const line of block.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
    if (FENCE.test(line)) {
      inFence = !inFence;
      if (inFence) fenceStart = cur.length;
    }
    const atBoundary = !inFence && cur.endsWith("\n\n") && cur.length >= max / 2;
    if (atBoundary) flush();
    else if (cur.length + line.length > max) {
      if (inFence && fenceStart > 0) {
        pieces.push(cur.slice(0, fenceStart));
        cur = cur.slice(fenceStart);
        fenceStart = 0;
      } else flush();
    }
    // A single line longer than max: cut it.
    if (line.length > max) {
      for (let i = 0; i < line.length; i += max) pieces.push(line.slice(i, i + max));
      continue;
    }
    cur += line;
  }
  flush();
  return pieces;
}

export function splitSections(
  text: string,
  max = MAX_SECTION_CHARS,
  min = MIN_SECTION_CHARS,
): string[] {
  const blocks = splitAtHeadings(text).flatMap((b) => (b.length > max ? splitOversized(b, max) : [b]));
  const sections: string[] = [];
  let cur = "";
  for (const block of blocks) {
    if (cur && cur.length < min && cur.length + block.length <= max) cur += block;
    else {
      if (cur) sections.push(cur);
      cur = block;
    }
  }
  if (cur) sections.push(cur);
  return sections.filter((s) => s.trim().length > 0);
}
