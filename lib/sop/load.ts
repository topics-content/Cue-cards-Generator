import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { InputType } from "@/lib/parsers";
import type { SystemBlock } from "@/lib/openrouter";
import { estimateTokens } from "@/lib/pricing";

const dir = path.join(process.cwd(), "lib", "sop");
const read = (rel: string) => readFileSync(path.join(dir, rel), "utf8");
const stripComments = (s: string) => s.replace(/<!--[\s\S]*?-->/g, "").trim();
const isPlaceholder = (s: string) => stripComments(s).length < 50;

export class SopMissingError extends Error {}

/** Notebook input uses the notebook example pair; everything else uses the prose pair. */
export function loadSopBlocks(inputType: InputType): { blocks: SystemBlock[]; tokens: number } {
  const kind = inputType === "ipynb" ? "notebook" : "prose";
  const files = {
    "lib/sop/guidelines.md": read("guidelines.md"),
    [`lib/sop/examples/${kind}-source.md`]: read(`examples/${kind}-source.md`),
    [`lib/sop/examples/${kind}-cards.md`]: read(`examples/${kind}-cards.md`),
  };
  const empty = Object.entries(files).filter(([, v]) => isPlaceholder(v)).map(([k]) => k);
  if (empty.length) throw new SopMissingError(`Fill in these files before generating: ${empty.join(", ")}`);

  const [sop, source, cards] = Object.values(files).map(stripComments);
  const blocks: SystemBlock[] = [
    { text: `# SOP\n\n${sop}`, cache: true },
    { text: `# Golden example\n\n## Source\n\n${source}\n\n## Cue cards\n\n${cards}`, cache: true },
  ];
  return { blocks, tokens: blocks.reduce((n, b) => n + estimateTokens(b.text.length), 0) };
}
