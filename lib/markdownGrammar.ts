// The markdown grammar and colour mapping shared by the read-only results page
// (components/HighlightedMarkdown.tsx, which only needs to parse+colour text, never edit it) and
// the live editor (lib/markdownEditor.ts + DeckEditor.tsx).
//
// Deliberately built from @lezer/markdown + @lezer/html directly, NOT from @codemirror/lang-markdown
// — that package's markdownLanguage/markdown() unconditionally `require("@codemirror/lang-html")` at
// module load (to wire up its default embedded-HTML support), which itself pulls in
// @codemirror/autocomplete and @codemirror/view. That's ~200KB of edit-time UI code (tooltips,
// completion, DOM decorations) with nothing to do with drawing coloured <span>s in a <pre>, but a
// results page showing many read-only cards would pay for it on every load. This file only ever
// imports the small, dependency-free @lezer/* grammar packages, confirmed via `npm run build`
// (see docs/decisions.md). The live editor (lib/markdownEditor.ts) already needs the full
// @codemirror/view stack regardless, so it uses @codemirror/lang-markdown's richer LanguageSupport
// (real edit-time HTML tag completion, markdown keymap) instead — same highlighter, heavier grammar.
import { parser as mdParser, GFM, Subscript, Superscript, Emoji, parseCode } from "@lezer/markdown";
import { parser as htmlParser } from "@lezer/html";
import { tagHighlighter, tags as t, type Highlighter } from "@lezer/highlight";
import type { Tree } from "@lezer/common";

// Same feature set as @codemirror/lang-markdown's own `markdownLanguage` (GFM tables/strikethrough/
// task lists + subscript/superscript/emoji), plus nested HTML parsing for `<span style="...">` etc.
const mdTreeParser = mdParser.configure([GFM, Subscript, Superscript, Emoji, parseCode({ htmlParser })]);

export function parseMarkdown(text: string): Tree {
  return mdTreeParser.parse(text);
}

/**
 * Maps tags to fixed CSS classes (defined in app/globals.css, next to .md-preview) rather than
 * inline colours or a CodeMirror HighlightStyle — this needs to work identically whether it's
 * driving the live editor's syntaxHighlighting() extension or this file's plain highlightCode()
 * static rendering, and a HighlightStyle's colours only ever reach the page via an EditorView's own
 * style injection, which the read-only results page never creates.
 */
export const mdHighlighter: Highlighter = tagHighlighter([
  { tag: [t.heading1, t.heading2, t.heading3, t.heading4, t.heading5, t.heading6], class: "md-hl-heading" },
  { tag: t.strong, class: "md-hl-strong" },
  { tag: t.emphasis, class: "md-hl-emphasis" },
  { tag: t.monospace, class: "md-hl-code" },
  { tag: [t.link, t.url], class: "md-hl-link" },
  { tag: t.quote, class: "md-hl-quote" },
  { tag: t.list, class: "md-hl-list" },
  { tag: [t.processingInstruction, t.angleBracket, t.definitionOperator], class: "md-hl-mark" },
  { tag: [t.labelName, t.string], class: "md-hl-label" },
  { tag: t.comment, class: "md-hl-comment" },
  { tag: t.tagName, class: "md-hl-tag" },
  { tag: t.attributeName, class: "md-hl-attr" },
  { tag: t.attributeValue, class: "md-hl-value" },
]);
