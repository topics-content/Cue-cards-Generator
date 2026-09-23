"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { splitCards } from "@/lib/cards";
import { duration, inr, tokens, usd } from "@/lib/format";
import { MarkdownPreview } from "@/components/MarkdownPreview";
import { CueCardValidatorDialog } from "@/components/CueCardValidatorDialog";
import type { ReviewStatus } from "@/lib/decks";

export type Stats = { inputTokens: number; outputTokens: number; cachedTokens: number; costUsd: number };

type Props = {
  program: string;
  module: string;
  className: string;
  source: string;
  markdown: string;
  stats: Stats;
  inrRate: number;
  budget: number;
  elapsedMs?: number | null;
  running?: boolean;
  filenameBase: string;
  children?: ReactNode; // banners, progress, controls
  deckId: string;
  generationDone: boolean;
  reviewStatus: ReviewStatus;
  onReviewStatusChange: (status: ReviewStatus) => void;
};

function CopyButton({ text, label, className = "" }: { text: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard blocked; nothing useful to do */
        }
      }}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-muted transition hover:border-accent hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${className}`}
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></svg>
      )}
    </button>
  );
}

export function OutputView(p: Props) {
  const [mode, setMode] = useState<"raw" | "preview">("preview");
  const [copiedAll, setCopiedAll] = useState(false);
  const [validatorOpen, setValidatorOpen] = useState(false);
  const cards = useMemo(() => splitCards(p.markdown), [p.markdown]);
  const outRef = useRef<HTMLDivElement>(null);

  // Follow the stream, but only while the reader is already near the bottom.
  useEffect(() => {
    const el = outRef.current;
    if (p.running && el && el.scrollHeight - el.scrollTop - el.clientHeight < 160) el.scrollTop = el.scrollHeight;
  }, [p.markdown, p.running]);

  const cachedPct = p.stats.inputTokens ? (p.stats.cachedTokens / p.stats.inputTokens) * 100 : 0;
  const download = () => {
    const url = URL.createObjectURL(new Blob([p.markdown], { type: "text/markdown" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `${p.filenameBase}.md` });
    a.click();
    URL.revokeObjectURL(url);
  };
  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(p.markdown);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };
  const metric = "flex flex-col";
  const label = "text-[11px] uppercase tracking-wide text-muted";
  const paneBody = "h-[60vh] overflow-auto lg:h-[calc(100vh-17rem)] lg:min-h-[24rem]";

  return (
    <div>
      <div className="sticky top-14 z-[5] -mx-4 border-b border-line bg-background/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <p className="truncate text-xs text-muted">
              {p.program} <span aria-hidden>›</span> {p.module}
            </p>
            <div className="flex items-center gap-2">
              <h1 className="truncate text-lg font-semibold tracking-tight">{p.className}</h1>
              <span
                className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
                  p.reviewStatus === "completed" ? "bg-ok-soft text-ok" : "bg-line text-muted"
                }`}
              >
                {p.reviewStatus === "completed" ? "✓ Verified" : "Draft"}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm tabular-nums">
            <div className={metric}><span className={label}>Tokens in / out</span><span>{tokens(p.stats.inputTokens)} / {tokens(p.stats.outputTokens)}</span></div>
            <div className={metric}><span className={label}>Cached</span><span>{cachedPct.toFixed(0)}%</span></div>
            {p.elapsedMs != null && (
              <div className={metric}><span className={label}>Elapsed</span><span>{duration(p.elapsedMs)}</span></div>
            )}
            <div className={metric} aria-live="polite">
              <span className={label}>Cost{p.running ? " (live)" : ""}</span>
              <span className="font-semibold text-brand">
                {usd(p.stats.costUsd)} <span className="font-normal text-muted">· {inr(p.stats.costUsd, p.inrRate)}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {p.children && <div className="mt-4 space-y-4">{p.children}</div>}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section aria-label="Source" className="rounded-xl border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-4 py-2">
            <h2 className="text-sm font-semibold">Source</h2>
            <span className="text-xs text-muted">{p.source.length.toLocaleString()} chars · read-only</span>
          </div>
          <pre className={`${paneBody} whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed`}>{p.source}</pre>
        </section>

        <section aria-label="Cue cards" className="rounded-xl border border-line bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2">
            <h2 className="text-sm font-semibold">
              Cue cards <span className="font-normal text-muted">({cards.length})</span>
            </h2>
            <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setValidatorOpen(true)} disabled={!p.markdown} className="rounded-lg border border-line px-4 py-2 text-xs font-medium transition hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50">
              Validate this cue card
            </button>
            <button type="button" onClick={copyAll} disabled={!p.markdown} className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-fg transition hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50">
              {copiedAll ? "✓ Copied" : "Copy all"}
            </button>
            <button type="button" onClick={download} disabled={!p.markdown} className="rounded-lg border border-line px-4 py-2 text-xs font-medium transition hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50">
              Download .md
            </button>
            <div role="group" aria-label="View" className="inline-flex overflow-hidden rounded-lg border border-line text-xs font-medium">
              {(["raw", "preview"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => setMode(m)}
                  className={`px-4 py-2 capitalize transition ${mode === m ? "bg-primary text-primary-fg" : "text-muted hover:text-foreground"}`}
                >
                  {m}
                </button>
              ))}
            </div>
            </div>
          </div>
          <div ref={outRef} className={`${paneBody} space-y-4 p-4`}>
            {cards.length === 0 && (
              <p className="text-sm text-muted">{p.running ? "Waiting for the first cards…" : "Cue cards will appear here."}</p>
            )}
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
                  <CopyButton text={c.raw} label={`Copy card ${i + 1}`} />
                </header>
                <div className="p-4">
                  {mode === "raw" ? (
                    <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">{c.raw}</pre>
                  ) : (
                    <MarkdownPreview markdown={c.body} />
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <CueCardValidatorDialog
        open={validatorOpen}
        onClose={() => setValidatorOpen(false)}
        deckId={p.deckId}
        markdown={p.markdown}
        generationDone={p.generationDone}
        reviewStatus={p.reviewStatus}
        onReviewStatusChange={p.onReviewStatusChange}
      />
    </div>
  );
}
