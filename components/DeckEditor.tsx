"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Spinner } from "@/components/Spinner";
import { IssueBox, toGroups } from "@/components/ValidationIssues";
import { splitCards } from "@/lib/cards";
import { validateMarkdown, type ValidationResult } from "@/lib/validateCards";
import type { ReviewStatus } from "@/lib/decks";

type Props = {
  deckId: string;
  program: string;
  module: string;
  className: string;
  source: string;
  /** The deck's currently saved cue cards (edited_output_md if present, else output_md). */
  markdown: string;
  initialReviewStatus: ReviewStatus;
};

const IMAGE_SNIPPET = "<img src='Link of Image' width=100%>";
const ANIMATION_SNIPPET = '<iframe src="Link of Hosted Animations" width="100%" height="700" style="border:1px solid #ccc; border-radius:8px;"></iframe>';

/**
 * Full-screen replacement for the old modal validator: source and cue cards side by side, an
 * editable textarea instead of a read-only preview, and Save wired to the same server-side
 * re-validation the old "Mark as completed" flow used (see app/api/decks/[id]/complete/route.ts) —
 * it just no longer blocks saving on a clean result, only on marking the deck reviewed.
 */
export function DeckEditor(p: Props) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const [text, setText] = useState(p.markdown);
  const [savedText, setSavedText] = useState(p.markdown);
  const [result, setResult] = useState<ValidationResult>(() => validateMarkdown(p.markdown));
  const [validatedText, setValidatedText] = useState(p.markdown);
  const [reviewStatus, setReviewStatus] = useState(p.initialReviewStatus);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const dirty = text !== savedText;
  const needsValidation = text !== validatedText;
  const cards = useMemo(() => splitCards(text), [text]);
  const { errGroups, warnGroups } = useMemo(() => toGroups(result), [result]);
  const verdictPass = result.totalErrors === 0;

  // Covers real navigation away (refresh, closing the actual browser tab, typing a new URL) — the
  // in-app back button below has its own confirm dialog, since this native prompt can't be styled
  // or triggered programmatically from a click handler.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const syncGutterScroll = () => {
    if (gutterRef.current && textareaRef.current) gutterRef.current.scrollTop = textareaRef.current.scrollTop;
  };

  // See CueCardValidatorDialog's original note: lines can't wrap in this textarea (wrap="off")
  // specifically so this math — line index × line height — stays exact.
  const jumpToLine = (line: number) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const lines = text.split("\n");
    const idx = Math.min(Math.max(line, 1), lines.length) - 1;
    const start = lines.slice(0, idx).reduce((n, l) => n + l.length + 1, 0);
    ta.focus();
    ta.setSelectionRange(start, start + lines[idx].length);
    const lineHeight = ta.scrollHeight / lines.length;
    ta.scrollTop = Math.max(0, lineHeight * idx - ta.clientHeight / 2);
    syncGutterScroll();
  };

  function insertAtCursor(snippet: string) {
    const ta = textareaRef.current;
    const start = ta?.selectionStart ?? text.length;
    const end = ta?.selectionEnd ?? text.length;
    setText(text.slice(0, start) + snippet + text.slice(end));
    requestAnimationFrame(() => {
      if (!ta) return;
      ta.focus();
      const pos = start + snippet.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  function revalidate() {
    setResult(validateMarkdown(text));
    setValidatedText(text);
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/decks/${p.deckId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", markdown: text }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(body.error ?? "Something went wrong.");
        if (body.result) setResult(body.result);
        return;
      }
      setSavedText(text);
      setValidatedText(text);
      if (body.result) setResult(body.result);
      setReviewStatus(body.reviewStatus);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
    } catch {
      setSaveError("Network error. Check your connection and retry.");
    } finally {
      setSaving(false);
    }
  }

  function goBack() {
    if (dirty) setConfirmOpen(true);
    else router.push(`/decks/${p.deckId}`);
  }

  const primary = "rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-fg transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50";
  const primarySm = "rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-fg transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50";
  const ghost = "rounded-lg border border-line px-3 py-1.5 text-xs font-medium transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="-mx-4 -my-8 flex h-[calc(100vh-3.5rem)] flex-col sm:-mx-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <button type="button" onClick={goBack} className="whitespace-nowrap text-sm font-medium text-muted transition hover:text-foreground">
            ← Back to cue cards
          </button>
          <div className="min-w-0">
            <p className="truncate text-xs text-muted">{p.program} <span aria-hidden>›</span> {p.module}</p>
            <div className="flex items-center gap-2">
              <h1 className="truncate text-base font-semibold tracking-tight">{p.className}</h1>
              <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${reviewStatus === "completed" ? "bg-ok-soft text-ok" : "bg-line text-muted"}`}>
                {reviewStatus === "completed" ? "✓ Verified" : "Draft"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {saveError ? (
            <span className="text-xs text-danger">{saveError}</span>
          ) : justSaved ? (
            <span className="text-xs font-medium text-ok">✓ Saved</span>
          ) : dirty ? (
            <span className="text-xs font-medium text-warn">Unsaved changes</span>
          ) : (
            <span className="text-xs text-muted">All changes saved</span>
          )}
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !dirty || needsValidation}
            title={needsValidation ? "Run Validate again — you've edited since the last check." : !dirty ? "Nothing to save." : undefined}
            className={primary}
          >
            {saving && <Spinner className="mr-2 inline h-3.5 w-3.5" />}Save
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-2 lg:p-6">
        <section aria-label="Source" className="flex min-h-0 flex-col rounded-xl border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-4 py-2">
            <h2 className="text-sm font-semibold">Source</h2>
            <span className="text-xs text-muted">{p.source.length.toLocaleString()} chars · read-only</span>
          </div>
          <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed">{p.source}</pre>
        </section>

        <section aria-label="Cue cards" className="flex min-h-0 flex-col rounded-xl border border-line bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2">
            <h2 className="text-sm font-semibold">
              Cue cards <span className="font-normal text-muted">({cards.length})</span>
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => insertAtCursor(IMAGE_SNIPPET)} className={ghost}>Add Image</button>
              <button type="button" onClick={() => insertAtCursor(ANIMATION_SNIPPET)} className={ghost}>Add Animation</button>
              {dirty && (
                <button type="button" onClick={() => setText(savedText)} className="text-xs text-muted underline decoration-dotted hover:text-foreground">
                  Reset to saved
                </button>
              )}
              <button type="button" onClick={revalidate} className={primarySm}>
                Validate
              </button>
            </div>
          </div>

          <div className="flex min-h-0 flex-[3] border-b border-line">
            <div ref={gutterRef} aria-hidden className="select-none overflow-hidden bg-background py-3 pl-2 pr-2 text-right font-mono text-xs leading-relaxed text-muted">
              {text.split("\n").map((_, i) => <div key={i}>{i + 1}</div>)}
            </div>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onScroll={syncGutterScroll}
              spellCheck={false}
              wrap="off"
              className="min-h-0 flex-1 resize-none overflow-auto whitespace-pre bg-transparent p-3 font-mono text-xs leading-relaxed outline-none"
            />
          </div>

          {/* Not flex flex-col on the inner children — see CueCardValidatorDialog's original note on why that crushed the issue list instead of letting it overflow. */}
          <div className="min-h-0 flex-[2] overflow-y-auto p-3">
            <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-semibold ${verdictPass ? "border-ok bg-ok-soft text-ok" : "border-danger bg-danger-soft text-danger"}`}>
              <span>{verdictPass ? "✓ Valid" : "✕ Invalid"}</span>
              <span className="font-normal text-muted">{result.cardCount} card{result.cardCount === 1 ? "" : "s"}</span>
              {needsValidation && <span className="text-xs font-normal text-warn">edited since last check</span>}
              <span className="ml-auto text-xs font-medium text-muted">
                {result.totalErrors} error{result.totalErrors === 1 ? "" : "s"} · {result.totalWarnings} warning{result.totalWarnings === 1 ? "" : "s"}
              </span>
            </div>
            <IssueBox kind="err" groups={errGroups} total={result.totalErrors} onJump={jumpToLine} />
            <IssueBox kind="warn" groups={warnGroups} total={result.totalWarnings} onJump={jumpToLine} />
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Discard unsaved changes?"
        confirmLabel="Discard and leave"
        onConfirm={() => router.push(`/decks/${p.deckId}`)}
        onCancel={() => setConfirmOpen(false)}
      >
        <p>You&apos;ve made edits since the last save. Leaving now discards them.</p>
      </ConfirmDialog>
    </div>
  );
}
