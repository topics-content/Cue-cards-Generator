"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MarkdownPreview } from "@/components/MarkdownPreview";
import { Spinner } from "@/components/Spinner";
import { IssueBox, toGroups } from "@/components/ValidationIssues";
import { frontmatterFenceLines, splitCards } from "@/lib/cards";
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

type View = "script" | "raw" | "preview";

const VIEW_OPTIONS: { value: View; label: string }[] = [
  { value: "script", label: "Script" },
  { value: "raw", label: "Cue cards (Raw)" },
  { value: "preview", label: "Cue cards (Preview)" },
];
const VIEW_LABEL: Record<View, string> = Object.fromEntries(VIEW_OPTIONS.map((o) => [o.value, o.label])) as Record<View, string>;

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
  // Mutable (not the readonly-`.current` RefObject useRef<T>(null) normally infers) since these
  // get assigned by hand in the merged ref callbacks below — see bindContentRef.
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const leftGutterRef = useRef<HTMLDivElement>(null);
  const rightGutterRef = useRef<HTMLDivElement>(null);
  const leftContentRef = useRef<HTMLElement | null>(null);
  const rightContentRef = useRef<HTMLElement | null>(null);
  const suppressScrollRef = useRef<{ left: boolean; right: boolean }>({ left: false, right: false });

  const [text, setText] = useState(p.markdown);
  const [savedText, setSavedText] = useState(p.markdown);
  const [result, setResult] = useState<ValidationResult>(() => validateMarkdown(p.markdown));
  const [validatedText, setValidatedText] = useState(p.markdown);
  const [reviewStatus, setReviewStatus] = useState(p.initialReviewStatus);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  // Left/right side-by-side content pickers. Kept distinct from each other (see setLeftView /
  // setRightView) since "raw" mounts the one shared textarea — two copies of it can't exist at once.
  const [leftView, setLeftView] = useState<View>("script");
  const [rightView, setRightView] = useState<View>("raw");

  const dirty = text !== savedText;
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);
  const needsValidation = text !== validatedText;
  const cards = useMemo(() => splitCards(text), [text]);
  const fenceLines = useMemo(() => frontmatterFenceLines(text), [text]);
  const { errGroups, warnGroups } = useMemo(() => toGroups(result), [result]);
  const verdictPass = result.totalErrors === 0;

  // Picking a view already showing on the other side swaps them instead of duplicating it —
  // keeps leftView !== rightView always true, so "raw" is never assigned to both sides.
  function setLeft(v: View) {
    if (v === rightView) setRightView(leftView);
    setLeftView(v);
  }
  function setRight(v: View) {
    if (v === leftView) setLeftView(rightView);
    setRightView(v);
  }

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

  // Browser/OS Back button. beforeunload doesn't fire for in-app history navigation, so we push a
  // spare history entry up front — the first Back press just consumes it (triggering popstate
  // instead of actually leaving), giving us a chance to check `dirty` before deciding whether to
  // let the navigation through or ask first via the same confirm dialog as the in-app back button.
  useEffect(() => {
    history.pushState(null, "", window.location.href);
    const handler = () => {
      if (dirtyRef.current) {
        setConfirmOpen(true);
        history.pushState(null, "", window.location.href);
      } else {
        router.push(`/decks/${p.deckId}`);
      }
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [router, p.deckId]);

  function bindContentRef(slot: "left" | "right", el: HTMLElement | null) {
    (slot === "left" ? leftContentRef : rightContentRef).current = el;
  }

  // Keeps each pane's own line-number gutter aligned with its content, and — since the two panes
  // rarely hold content of matching length — keeps the two panes scrolled to roughly the same
  // proportional depth rather than the same literal line.
  function handlePaneScroll(slot: "left" | "right", el: HTMLElement) {
    if (suppressScrollRef.current[slot]) {
      suppressScrollRef.current[slot] = false;
      return;
    }
    const gutterRef = slot === "left" ? leftGutterRef : rightGutterRef;
    if (gutterRef.current) gutterRef.current.scrollTop = el.scrollTop;

    const otherSlot: "left" | "right" = slot === "left" ? "right" : "left";
    const otherEl = (otherSlot === "left" ? leftContentRef : rightContentRef).current;
    if (!otherEl) return;
    const fromMax = el.scrollHeight - el.clientHeight;
    const toMax = otherEl.scrollHeight - otherEl.clientHeight;
    if (fromMax <= 0 || toMax <= 0) return;
    const newTop = (el.scrollTop / fromMax) * toMax;
    if (Math.abs(newTop - otherEl.scrollTop) > 0.5) suppressScrollRef.current[otherSlot] = true;
    otherEl.scrollTop = newTop;
    const otherGutterRef = otherSlot === "left" ? leftGutterRef : rightGutterRef;
    if (otherGutterRef.current) otherGutterRef.current.scrollTop = otherEl.scrollTop;
  }

  // See CueCardValidatorDialog's original note: lines can't wrap in this textarea (wrap="off")
  // specifically so this math — line index × line height — stays exact.
  const jumpToLine = (line: number) => {
    // Neither side may currently show the textarea — put it on the right so the jump has
    // somewhere to land (left is left untouched so Script, if showing there, stays put).
    const rawSlot: "left" | "right" = leftView === "raw" ? "left" : "right";
    if (leftView !== "raw" && rightView !== "raw") setRightView("raw");
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      const lines = text.split("\n");
      const idx = Math.min(Math.max(line, 1), lines.length) - 1;
      const start = lines.slice(0, idx).reduce((n, l) => n + l.length + 1, 0);
      ta.focus();
      ta.setSelectionRange(start, start + lines[idx].length);
      const lineHeight = ta.scrollHeight / lines.length;
      ta.scrollTop = Math.max(0, lineHeight * idx - ta.clientHeight / 2);
      handlePaneScroll(rawSlot, ta);
    });
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
    setPanelOpen(true);
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
        if (body.result) {
          setResult(body.result);
          setPanelOpen(true);
        }
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
  const selectCls = "rounded-lg border border-line bg-surface px-2 py-1.5 text-xs font-medium outline-none transition hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";

  function renderPanel(view: View, slot: "left" | "right") {
    const gutterRef = slot === "left" ? leftGutterRef : rightGutterRef;

    if (view === "script") {
      const lines = p.source.split("\n");
      return (
        <>
          <div className="flex items-center justify-between border-b border-line px-4 py-2">
            <h2 className="text-sm font-semibold">Script</h2>
            <span className="text-xs text-muted">{p.source.length.toLocaleString()} chars · read-only</span>
          </div>
          <div className="flex min-h-0 min-w-0 flex-1">
            <div ref={gutterRef} aria-hidden className="select-none overflow-hidden bg-background py-3 pl-2 pr-2 text-right font-mono text-xs leading-relaxed text-muted">
              {lines.map((_, i) => <div key={i}>{i + 1}</div>)}
            </div>
            <pre
              ref={(el) => bindContentRef(slot, el)}
              onScroll={(e) => handlePaneScroll(slot, e.currentTarget)}
              className="min-h-0 min-w-0 flex-1 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-xs leading-relaxed"
            >
              {p.source}
            </pre>
          </div>
        </>
      );
    }

    if (view === "raw") {
      return (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2">
            <h2 className="text-sm font-semibold">
              Cue cards (Raw) <span className="font-normal text-muted">({cards.length})</span>
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {/* preventDefault on mousedown keeps focus (and selectionStart/End) on the textarea —
                  otherwise clicking the button blurs it first and the insert falls back to appending
                  at the very end. */}
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insertAtCursor(IMAGE_SNIPPET)} className={ghost}>Add Image</button>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insertAtCursor(ANIMATION_SNIPPET)} className={ghost}>Add Animation</button>
              {dirty && (
                <button type="button" onClick={() => setText(savedText)} className="text-xs text-muted underline decoration-dotted hover:text-foreground">
                  Reset to saved
                </button>
              )}
            </div>
          </div>
          <div className="flex min-h-0 min-w-0 flex-1">
            <div ref={gutterRef} aria-hidden className="select-none overflow-hidden bg-background py-3 pl-2 pr-2 text-right font-mono text-xs leading-relaxed text-muted">
              {text.split("\n").map((_, i) => <div key={i}>{i + 1}</div>)}
            </div>
            <div className="relative min-h-0 min-w-0 flex-1">
              {/* Backdrop showing through the textarea's transparent background, highlighting each
                  card's `---` frontmatter fences — the textarea itself can't style individual lines.
                  Renders no real text (one nbsp per line, just to hold the right height): the
                  textarea on top already shows the actual characters, so a scroll-sync lag under
                  fast scrolling shows at most a misaligned tint, never doubled text. */}
              <div
                ref={highlightRef}
                aria-hidden
                className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre p-3 font-mono text-xs leading-relaxed"
              >
                {text.split("\n").map((_, i) => (
                  <div key={i} className={fenceLines.has(i) ? "-mx-3 bg-brand-soft px-3" : undefined}>
                    {"\u00A0"}
                  </div>
                ))}
              </div>
              <textarea
                ref={(el) => {
                  textareaRef.current = el;
                  bindContentRef(slot, el);
                }}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onScroll={(e) => {
                  handlePaneScroll(slot, e.currentTarget);
                  if (highlightRef.current) {
                    highlightRef.current.scrollTop = e.currentTarget.scrollTop;
                    highlightRef.current.scrollLeft = e.currentTarget.scrollLeft;
                  }
                }}
                spellCheck={false}
                wrap="off"
                className="absolute inset-0 resize-none overflow-auto whitespace-pre bg-transparent p-3 font-mono text-xs leading-relaxed outline-none"
              />
            </div>
          </div>
        </>
      );
    }

    return (
      <>
        <div className="flex items-center justify-between border-b border-line px-4 py-2">
          <h2 className="text-sm font-semibold">
            Cue cards (Preview) <span className="font-normal text-muted">({cards.length})</span>
          </h2>
        </div>
        <div
          ref={(el) => bindContentRef(slot, el)}
          onScroll={(e) => handlePaneScroll(slot, e.currentTarget)}
          className="min-h-0 min-w-0 flex-1 space-y-4 overflow-auto p-4"
        >
          {cards.length === 0 && <p className="text-sm text-muted">No cue cards yet.</p>}
          {cards.map((c, i) => (
            <article key={i} className="rounded-lg border border-line">
              <header className="flex items-center justify-between gap-4 border-b border-line bg-background px-4 py-2">
                <p className="truncate text-xs text-muted">
                  <span className="mr-2 rounded bg-surface px-2 py-0.5 font-medium text-brand">
                    {c.cardType === "quiz_card" ? "Quiz" : c.cardType === "cue_card" ? "Cue" : "Card"}
                  </span>
                  {c.title || "Untitled"}
                  {c.duration != null && <span> · {c.duration}s</span>}
                </p>
              </header>
              <div className="p-4">
                <MarkdownPreview markdown={c.body} />
              </div>
            </article>
          ))}
        </div>
      </>
    );
  }

  return (
    <div className="relative left-1/2 right-1/2 -mx-[50vw] -my-8 flex h-[calc(100vh-3.5rem)] w-screen flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-4 py-2 sm:px-6">
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
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <select aria-label="Left panel" value={leftView} onChange={(e) => setLeft(e.target.value as View)} className={selectCls}>
              {VIEW_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <span aria-hidden className="text-xs text-muted">↔</span>
            <select aria-label="Right panel" value={rightView} onChange={(e) => setRight(e.target.value as View)} className={selectCls}>
              {VIEW_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <button type="button" onClick={revalidate} className={primarySm}>
            Validate
          </button>
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

      {panelOpen && (
        <div className="max-h-[40vh] overflow-y-auto border-b border-line bg-surface px-4 py-3 sm:px-6">
          <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-semibold ${verdictPass ? "border-ok bg-ok-soft text-ok" : "border-danger bg-danger-soft text-danger"}`}>
            <span>{verdictPass ? "✓ Valid" : "✕ Invalid"}</span>
            <span className="font-normal text-muted">{result.cardCount} card{result.cardCount === 1 ? "" : "s"}</span>
            {needsValidation && <span className="text-xs font-normal text-warn">edited since last check</span>}
            <span className="ml-auto text-xs font-medium text-muted">
              {result.totalErrors} error{result.totalErrors === 1 ? "" : "s"} · {result.totalWarnings} warning{result.totalWarnings === 1 ? "" : "s"}
            </span>
            <button type="button" onClick={() => setPanelOpen(false)} aria-label="Close validation results" className="rounded-md border border-current/30 px-2 py-1 text-xs font-medium transition hover:bg-current/10">
              Close ✕
            </button>
          </div>
          <IssueBox kind="err" groups={errGroups} total={result.totalErrors} onJump={jumpToLine} />
          <IssueBox kind="warn" groups={warnGroups} total={result.totalWarnings} onJump={jumpToLine} />
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden p-3 lg:grid-cols-2 lg:gap-4 lg:p-4">
        <section aria-label={VIEW_LABEL[leftView]} className="flex min-h-0 min-w-0 flex-col rounded-xl border border-line bg-surface">
          {renderPanel(leftView, "left")}
        </section>
        <section aria-label={VIEW_LABEL[rightView]} className="flex min-h-0 min-w-0 flex-col rounded-xl border border-line bg-surface">
          {renderPanel(rightView, "right")}
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
