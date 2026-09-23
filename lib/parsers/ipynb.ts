import { ParseError } from "./errors";

export type NotebookResult = { text: string; imageCount: number };

const ANSI = new RegExp(String.fromCharCode(27) + "\\[[0-9;]*[A-Za-z]", "g");
// Catches base64 that leaks into text: data URIs, or a long unbroken base64-looking run.
const DATA_URI = /data:[\w.+-]+\/[\w.+-]+;base64,[A-Za-z0-9+/=\s]+/g;
const LONG_B64 = /[A-Za-z0-9+/]{400,}={0,2}/g;

const joinLines = (v: unknown): string =>
  Array.isArray(v) ? v.join("") : typeof v === "string" ? v : "";

type Cell = {
  cell_type?: string;
  source?: string[] | string;
  outputs?: Array<{
    output_type?: string;
    text?: string[] | string;
    data?: Record<string, string[] | string>;
  }>;
};

/**
 * Turns a notebook into markdown-ish text for the LLM.
 * Keeps cell sources and text outputs; every image output becomes `![plot-N](image-placeholder)`.
 * Image bytes never leave this function.
 */
export function parseNotebook(raw: string): NotebookResult {
  let nb: { cells?: Cell[] };
  try {
    nb = JSON.parse(raw);
  } catch {
    throw new ParseError("This file is not valid notebook JSON.");
  }
  if (!Array.isArray(nb.cells)) throw new ParseError("No cells found in this notebook.");

  let imageCount = 0;
  const placeholder = () => `![plot-${++imageCount}](image-placeholder)`;
  const scrub = (s: string) =>
    s.replace(DATA_URI, placeholder).replace(LONG_B64, "[binary data removed]");

  const blocks: string[] = [];
  for (const cell of nb.cells) {
    const source = scrub(joinLines(cell.source)).trimEnd();
    if (cell.cell_type === "markdown") {
      if (source) blocks.push(source);
    } else if (cell.cell_type === "code") {
      if (source) blocks.push("```python\n" + source + "\n```");
      for (const out of cell.outputs ?? []) {
        const data = out.data ?? {};
        const hasImage = Object.keys(data).some((k) => k.startsWith("image/"));
        if (out.output_type === "stream") {
          const t = scrub(joinLines(out.text)).replace(ANSI, "").trimEnd();
          if (t) blocks.push("Output:\n```text\n" + t + "\n```");
        } else if (out.output_type === "display_data" || out.output_type === "execute_result") {
          const t = scrub(joinLines(data["text/plain"])).replace(ANSI, "").trimEnd();
          // A figure's text/plain is just "<Figure size ...>"; the placeholder says it better.
          if (hasImage) blocks.push(placeholder());
          else if (t) blocks.push("Output:\n```text\n" + t + "\n```");
        }
        // "error" outputs (tracebacks) and text/html are intentionally dropped.
      }
    }
  }
  return { text: blocks.join("\n\n") + "\n", imageCount };
}
