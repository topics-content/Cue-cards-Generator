import type { ReactNode } from "react";
import { highlightCode } from "@lezer/highlight";
import { mdHighlighter, parseMarkdown } from "@/lib/markdownGrammar";

/**
 * Read-only syntax-coloured raw markdown — same grammar and colours as the live CodeMirror editor
 * in DeckEditor (see lib/markdownGrammar.ts), but without mounting a full EditorView per card: this
 * app can show dozens of cards' Raw text on one results page, and a live editor per card would be
 * needlessly heavy. Uses CodeMirror's own documented static-highlighting recipe (parse once, walk
 * the tree with highlightCode) to build plain <span>s instead — and, importantly, never imports
 * @codemirror/view (lib/markdownEditor.ts, which DeckEditor uses for the live editor, does), so
 * this page's bundle doesn't pay for editor-view code it never uses.
 */
export function HighlightedMarkdown({ text }: { text: string }) {
  const tree = parseMarkdown(text);
  const nodes: ReactNode[] = [];
  let key = 0;
  highlightCode(
    text,
    tree,
    mdHighlighter,
    (run, cls) => nodes.push(cls ? <span key={key++} className={cls}>{run}</span> : run),
    () => nodes.push("\n")
  );
  return <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">{nodes}</pre>;
}
