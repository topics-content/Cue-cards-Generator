"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Spinner } from "@/components/Spinner";
import { validateMarkdown, type Issue, type ValidationResult } from "@/lib/validateCards";
import type { ReviewStatus } from "@/lib/decks";

type Props = {
  open: boolean;
  onClose: () => void;
  deckId: string;
  /** The deck's current saved cue cards, used to prefill the checker each time it's opened. */
  markdown: string;
  /** Whether generation has finished — "Mark as completed" is only ever possible once it has. */
  generationDone: boolean;
  reviewStatus: ReviewStatus;
  onReviewStatusChange: (status: ReviewStatus) => void;
};

type Group = { key: string; name: string; type?: string; title?: string; loc?: string; items: Issue[] };

function IssueRow({ issue, tone }: { issue: Issue; tone: "e" | "w" }) {
  const border = tone === "e" ? "border-l-danger" : "border-l-warn";
  const tagCls = tone === "e" ? "bg-danger-soft text-danger" : "bg-warn-soft text-warn";
  return (
    <div className={`mt-2 rounded-md border border-line border-l-4 ${border} bg-background p-3 text-xs leading-relaxed`}>
      <span className={`mr-2 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${tagCls}`}>{tone === "e" ? "ERROR" : "WARN"}</span>
      <span className="font-semibold text-muted">L{issue.line}</span> <span>{issue.msg}</span>
      {issue.hint && <span className="mt-1 block text-muted">↳ {issue.hint}</span>}
    </div>
  );
}

function IssueGroupRow({ g, tone, open, onToggle }: { g: Group; tone: "e" | "w"; open: boolean; onToggle: () => void }) {
  return (
    <div className="border-t border-line first:border-t-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-background"
      >
        <span className={`inline-block transition-transform ${open ? "rotate-90" : ""}`}>▸</span>
        <span className="font-semibold">{g.name}</span>
        {g.type && <span className="rounded bg-line px-1.5 py-0.5 text-[10px] font-bold text-muted">{g.type}</span>}
        <span className="truncate text-muted">{g.title}</span>
        <span className="ml-auto rounded-full bg-line px-1.5 py-0.5 text-[10px] font-bold text-muted">{g.items.length}</span>
        {g.loc && <span className="whitespace-nowrap text-muted">{g.loc}</span>}
      </button>
      {open && <div className="px-3 pb-3">{g.items.map((it, i) => <IssueRow key={i} issue={it} tone={tone} />)}</div>}
    </div>
  );
}

function IssueBox({ kind, groups, total }: { kind: "err" | "warn"; groups: Group[]; total: number }) {
  const [boxOpen, setBoxOpen] = useState(kind === "err" ? total > 0 : total > 0);
  const [rowOpen, setRowOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(groups.map((g) => [g.key, true])));
  const isErr = kind === "err";
  const label = isErr ? "Errors" : "Warnings";
  const tone = isErr ? "e" : "w";
  const pillCls = isErr ? "bg-danger-soft text-danger" : "bg-warn-soft text-warn";

  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-line">
      <button type="button" onClick={() => setBoxOpen((o) => !o)} className="flex w-full items-center gap-2 bg-background px-3 py-2.5 text-left text-sm font-semibold hover:bg-surface">
        <span className={`inline-block transition-transform ${boxOpen ? "rotate-90" : ""}`}>▸</span>
        {label}
        <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-bold ${pillCls}`}>{total}</span>
        {boxOpen && groups.length > 0 && (
          <span className="ml-auto flex gap-2 text-[11px] font-medium text-muted">
            <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); setRowOpen(Object.fromEntries(groups.map((g) => [g.key, true]))); }} className="hover:text-foreground">
              Expand all
            </span>
            <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); setRowOpen(Object.fromEntries(groups.map((g) => [g.key, false]))); }} className="hover:text-foreground">
              Collapse all
            </span>
          </span>
        )}
      </button>
      {boxOpen && (
        <div>
          {groups.length === 0 ? (
            <p className="p-3 text-xs text-muted">No {label.toLowerCase()} found.</p>
          ) : (
            groups.map((g) => (
              <IssueGroupRow key={g.key} g={g} tone={tone} open={rowOpen[g.key] ?? true} onToggle={() => setRowOpen((s) => ({ ...s, [g.key]: !s[g.key] }))} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function toGroups(result: ValidationResult): { errGroups: Group[]; warnGroups: Group[] } {
  const errGroups: Group[] = [];
  if (result.docErrors.length) errGroups.push({ key: "doc", name: "Document", title: "issues outside any card", items: result.docErrors });
  for (const c of result.cards) {
    if (c.errors.length) errGroups.push({ key: `err-${c.index}`, name: `Card ${c.index}`, type: c.cardType, title: c.title, loc: c.loc, items: c.errors });
  }
  const warnGroups: Group[] = [];
  for (const c of result.cards) {
    if (c.warnings.length) warnGroups.push({ key: `warn-${c.index}`, name: `Card ${c.index}`, type: c.cardType, title: c.title, loc: c.loc, items: c.warnings });
  }
  return { errGroups, warnGroups };
}

/**
 * The site-embedded twin of the standalone Cue Card Validator tool. Runs the same rule-based
 * checks (lib/validateCards.ts) entirely in the browser — no LLM call, no network round trip for
 * validation itself. The only network call is the explicit "Mark as completed" action, which asks
 * the server to independently re-check the real saved output before flipping review status.
 */
export function CueCardValidatorDialog(p: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState(p.markdown);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (p.open && !d.open) d.showModal();
    if (!p.open && d.open) d.close();
  }, [p.open]);

  // Re-seed from the live deck content, and re-validate immediately, each time the dialog opens.
  useEffect(() => {
    if (!p.open) return;
    setText(p.markdown);
    setResult(validateMarkdown(p.markdown));
    setCompleteError(null);
  }, [p.open, p.markdown]);

  const revalidate = () => setResult(validateMarkdown(text));
  const { errGroups, warnGroups } = useMemo(() => (result ? toGroups(result) : { errGroups: [], warnGroups: [] }), [result]);

  // "Mark as completed" only makes sense when the textarea still matches the saved output — if the
  // reader edited it just to test something, they're validating a hypothetical, not the real deck.
  const editedFromSaved = text !== p.markdown;

  async function act(action: "complete" | "revert") {
    setCompleting(true);
    setCompleteError(null);
    try {
      const res = await fetch(`/api/decks/${p.deckId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCompleteError(body.error ?? "Something went wrong.");
        if (body.result) setResult(body.result); // server's authoritative re-check, if it ran one
        return;
      }
      p.onReviewStatusChange(body.reviewStatus);
    } catch {
      setCompleteError("Network error. Check your connection and retry.");
    } finally {
      setCompleting(false);
    }
  }

  const verdictPass = result != null && result.totalErrors === 0;
  const primary = "rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-fg transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50";
  const ghost = "rounded-lg border border-line px-4 py-2 text-sm font-medium transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <dialog
      ref={ref}
      aria-labelledby="validator-title"
      onCancel={(e) => {
        e.preventDefault();
        p.onClose();
      }}
      className="m-auto h-[min(94vh,54rem)] w-[min(96vw,72rem)] rounded-xl border border-line bg-surface p-0 text-foreground shadow-xl backdrop:bg-black/50"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <div>
            <h2 id="validator-title" className="text-base font-semibold">Cue card validator</h2>
            <p className="text-xs text-muted">Rule-based checks, run entirely in your browser — no LLM involved.</p>
          </div>
          <button type="button" onClick={p.onClose} aria-label="Close" className="rounded-md p-1.5 text-muted hover:bg-background hover:text-foreground">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-5 lg:grid-cols-2">
          <section className="flex min-h-0 flex-col rounded-lg border border-line">
            <div className="flex items-center justify-between border-b border-line px-3 py-2 text-xs">
              <span className="font-semibold uppercase tracking-wide text-muted">Markdown</span>
              <div className="flex items-center gap-2">
                {editedFromSaved && <span className="text-warn">edited, not saved</span>}
                <button type="button" onClick={() => setText(p.markdown)} disabled={!editedFromSaved} className="text-muted underline decoration-dotted hover:text-foreground disabled:no-underline disabled:opacity-40">
                  Reset to saved
                </button>
              </div>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
              className="min-h-0 flex-1 resize-none bg-transparent p-3 font-mono text-xs leading-relaxed outline-none"
            />
            <div className="border-t border-line p-2">
              <button type="button" onClick={revalidate} className={primary}>Validate</button>
            </div>
          </section>

          <section className="flex min-h-0 flex-col overflow-y-auto rounded-lg border border-line p-3">
            {result == null ? (
              <p className="text-sm text-muted">Awaiting input.</p>
            ) : (
              <>
                <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-semibold ${verdictPass ? "border-ok bg-ok-soft text-ok" : "border-danger bg-danger-soft text-danger"}`}>
                  <span>{verdictPass ? "✓ Valid" : "✕ Invalid"}</span>
                  <span className="font-normal text-muted">
                    {result.cardCount} card{result.cardCount === 1 ? "" : "s"}
                  </span>
                  <span className="ml-auto text-xs font-medium text-muted">
                    {result.totalErrors} error{result.totalErrors === 1 ? "" : "s"} · {result.totalWarnings} warning{result.totalWarnings === 1 ? "" : "s"}
                  </span>
                </div>

                <IssueBox kind="err" groups={errGroups} total={result.totalErrors} />
                <IssueBox kind="warn" groups={warnGroups} total={result.totalWarnings} />
              </>
            )}
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line px-5 py-3">
          {completeError && <span className="mr-auto text-xs text-danger">{completeError}</span>}
          {p.reviewStatus === "completed" ? (
            <>
              <span className="mr-auto text-xs font-medium text-ok">✓ Marked completed</span>
              <button type="button" onClick={() => void act("revert")} disabled={completing} className={ghost}>
                {completing && <Spinner className="mr-2 inline h-3.5 w-3.5" />}Revert to draft
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void act("complete")}
              disabled={completing || !p.generationDone || !verdictPass || editedFromSaved}
              title={
                !p.generationDone
                  ? "Generation isn't finished yet."
                  : editedFromSaved
                    ? "Reset to the saved markdown before marking completed — edits here aren't saved."
                    : !verdictPass
                      ? "Fix the errors above first."
                      : undefined
              }
              className={primary}
            >
              {completing && <Spinner className="mr-2 inline h-3.5 w-3.5" />}Mark as completed
            </button>
          )}
          <button type="button" onClick={p.onClose} className={ghost}>Close</button>
        </div>
      </div>
    </dialog>
  );
}
