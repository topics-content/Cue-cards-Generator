// The live-editor half of the raw-editor setup — kept separate from lib/markdownGrammar.ts so the
// read-only results page, which only needs that file's dependency-free static grammar/colours,
// doesn't pull in @codemirror/view, @codemirror/lang-html or @codemirror/autocomplete too. Only
// DeckEditor.tsx (which already needs a live EditorView, and so already pays for that weight)
// imports this file.
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { syntaxHighlighting } from "@codemirror/language";
import { EditorView, Decoration, type DecorationSet, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { RangeSetBuilder, type Extension } from "@codemirror/state";
import { frontmatterFenceLines, markupLineKinds, type LineKind } from "@/lib/cards";
import { mdHighlighter } from "@/lib/markdownGrammar";

/**
 * GFM markdown + nested language highlighting inside fenced code blocks (```sql=, ```python=), plus
 * real edit-time behaviour (HTML tag completion, the markdown keymap) — the richer LanguageSupport
 * @codemirror/lang-markdown provides, worth its extra weight here since this is a real editor.
 * mdSyntaxHighlighting reuses mdHighlighter from lib/markdownGrammar.ts, so live and static colours
 * always match even though the two files build the parse tree differently.
 */
export const mdLanguageSupport = markdown({ base: markdownLanguage, codeLanguages: languages });
export const mdSyntaxHighlighting = syntaxHighlighting(mdHighlighter);

/** Matches the surrounding panel (transparent background, app's mono font, text-xs/leading-relaxed). */
export const cmTheme = EditorView.theme({
  "&": { height: "100%", fontSize: "0.75rem", backgroundColor: "transparent", color: "var(--foreground)" },
  "&.cm-focused": { outline: "none" },
  ".cm-content": { fontFamily: "var(--font-mono), ui-monospace, monospace", lineHeight: "1.625", padding: "0.75rem", caretColor: "var(--foreground)" },
  ".cm-line": { padding: "0" },
  ".cm-gutters": { backgroundColor: "var(--background)", color: "var(--muted)", border: "none", fontFamily: "var(--font-mono), ui-monospace, monospace", fontSize: "0.75rem" },
  ".cm-gutterElement": { padding: "0 0.5rem" },
});

/** Ensures no native spellcheck squiggles under markdown/code, matching the old textarea's spellCheck={false}. */
export const noSpellcheck: Extension = EditorView.contentAttributes.of({ spellcheck: "false" });

/**
 * Per-line background classes (card `---` fences, headings, img/iframe lines) — recomputed
 * straight from the live CodeMirror doc on every change, using the existing, unchanged
 * frontmatterFenceLines/markupLineKinds from lib/cards.ts, so this stays in sync with typing with
 * no React round-trip. `classFor` supplies the actual class-name strings (kept in the component
 * that renders this pane, since Tailwind's content scan only covers app/ and components/, not lib/).
 */
export function lineDecorationExtension(classFor: (isFence: boolean, kind: LineKind) => string | null): Extension {
  function build(view: EditorView): DecorationSet {
    const text = view.state.doc.toString();
    const fenceLines = frontmatterFenceLines(text);
    const lineKinds = markupLineKinds(text);
    const builder = new RangeSetBuilder<Decoration>();
    for (let i = 1; i <= view.state.doc.lines; i++) {
      const idx = i - 1;
      const cls = classFor(fenceLines.has(idx), lineKinds[idx] ?? null);
      if (cls) {
        const from = view.state.doc.line(i).from;
        builder.add(from, from, Decoration.line({ class: cls }));
      }
    }
    return builder.finish();
  }
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = build(view);
      }
      update(u: ViewUpdate) {
        if (u.docChanged) this.decorations = build(u.view);
      }
    },
    { decorations: (v) => v.decorations }
  );
}
