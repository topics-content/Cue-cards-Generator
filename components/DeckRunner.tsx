"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OutputView, type Stats } from "@/components/OutputView";
import { Spinner } from "@/components/Spinner";
import { runWithConcurrency } from "@/lib/concurrency";
import type { ReviewStatus } from "@/lib/decks";
import { usd, inr } from "@/lib/format";
import {
  continueBudget, finalizeDeck, PipelineError, prewarmCache, runPass, scheduleReconcile, type BudgetStop,
} from "@/lib/pipeline";
import { runningSummary } from "@/lib/prompts";

type Props = {
  deckId: string;
  program: string;
  module: string;
  className: string;
  source: string;
  sections: string[];
  /** Pass 1 draft per section index ("" if not drafted yet). */
  initialDrafts: string[];
  /** Audited final output per section index ("" if not audited yet). */
  initialOutputs: string[];
  initialStats: Stats;
  initialReviewStatus: ReviewStatus;
  inrRate: number;
  budget: number;
  /** May start, resume or continue this run: its creator, or an admin. */
  isOwner: boolean;
  autoStart?: boolean;
  /** Set when reopening cue cards that are paused at a spend cap. */
  initialStop?: BudgetStop | null;
};

type Phase = "idle" | "generating" | "auditing" | "done" | "budget" | "error";

// How many audits run at once in Phase 2. Generation (Phase 1) always stays strictly sequential —
// each section's continuity depends on the previous section's own draft — but audits don't depend
// on each other at all, so they're the safe thing to parallelize. See the budget reservation in
// lib/decks.ts for how the $3/$5 cap stays a real cap under this concurrency.
const AUDIT_CONCURRENCY = 3;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cue-cards";

export function DeckRunner(p: Props) {
  const n = p.sections.length;
  const drafts = useRef<string[]>(p.sections.map((_, i) => p.initialDrafts[i] ?? ""));
  const outputs = useRef<string[]>(p.sections.map((_, i) => p.initialOutputs[i] ?? ""));
  const running = useRef(false);
  const started = useRef(false);
  const abort = useRef<AbortController | null>(null);

  const [texts, setTexts] = useState<string[]>(() => outputs.current.map((o, i) => o || drafts.current[i]));
  const [drafted, setDrafted] = useState<boolean[]>(() => drafts.current.map(Boolean));
  const [finals, setFinals] = useState<boolean[]>(() => outputs.current.map(Boolean));
  const [activeGenerate, setActiveGenerate] = useState<number | null>(null);
  const [activeAudits, setActiveAudits] = useState<number[]>([]);
  const [phase, setPhase] = useState<Phase>(() => (p.initialStop ? "budget" : outputs.current.every(Boolean) ? "done" : "idle"));
  const [stats, setStats] = useState<Stats>(p.initialStats);
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>(p.initialReviewStatus);
  const [error, setError] = useState<{ index: number; message: string } | null>(null);
  const [stop, setStop] = useState<BudgetStop | null>(p.initialStop ?? null);
  const [continuing, setContinuing] = useState(false);
  const [continueError, setContinueError] = useState<string | null>(null);
  const [t0, setT0] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);

  useEffect(() => {
    if ((phase !== "generating" && phase !== "auditing") || t0 == null) return;
    const id = setInterval(() => setElapsed(Date.now() - t0), 500);
    return () => clearInterval(id);
  }, [phase, t0]);

  const setText = (i: number, v: string) => setTexts((t) => t.map((x, j) => (j === i ? v : x)));

  const run = useCallback(
    async () => {
      if (running.current) return;
      running.current = true;
      const ac = new AbortController();
      abort.current = ac;
      const start = Date.now();
      setT0(start);
      setElapsed(0);
      setError(null);
      setStop(null);

      const add = (r: { usage: { inputTokens: number; outputTokens: number; cachedTokens: number }; spent: number }) =>
        setStats((s) => ({
          inputTokens: s.inputTokens + r.usage.inputTokens,
          outputTokens: s.outputTokens + r.usage.outputTokens,
          cachedTokens: s.cachedTokens + r.usage.cachedTokens,
          costUsd: r.spent, // server total for these cue cards: the authoritative running figure
        }));

      let budgetHit: BudgetStop | null = null;
      let hardError: { index: number; message: string } | null = null;
      let at = 0;

      try {
        void prewarmCache(p.deckId); // best-effort; never blocks or throws

        // ---- Phase 1: generate every section's draft, strictly sequential ----
        // Each section's continuity note is built from the PREVIOUS section's draft, not its
        // audited version — the audit hasn't happened yet at this point for any later section, by
        // design (that's what makes Phase 2's audits independent of each other and safe to run
        // concurrently). A rare, accepted trade-off: if Phase 1 drifts on something in section 3,
        // section 4 builds on that drift, not the correction the audit makes to section 3 later.
        if (drafts.current.some((d, i) => !d && !outputs.current[i])) {
          setPhase("generating");
          for (let i = 0; i < n; i++) {
            at = i;
            if (ac.signal.aborted) throw new PipelineError("Stopped", "aborted");
            if (drafts.current[i] || outputs.current[i]) continue;
            setActiveGenerate(i);
            setText(i, "");
            let acc = "";
            const summary = runningSummary(drafts.current.slice(0, i).filter(Boolean));
            const r1 = await runPass({
              deckId: p.deckId, sectionIndex: i, totalSections: n, section: p.sections[i],
              pass: 1, summary, signal: ac.signal, onText: (d) => setText(i, (acc += d)),
            });
            drafts.current[i] = r1.text;
            setDrafted((d) => d.map((x, j) => (j === i ? true : x)));
            add(r1);
          }
        }
        setActiveGenerate(null);

        // ---- Phase 2: audit every section, up to AUDIT_CONCURRENCY at once ----
        setPhase("auditing");
        await runWithConcurrency(
          n,
          AUDIT_CONCURRENCY,
          async (i) => {
            if (outputs.current[i]) return; // already audited (e.g. resuming)
            if (!drafts.current[i]) return; // shouldn't happen once Phase 1 completes; defensive
            setActiveAudits((s) => [...s, i]);
            let acc = "";
            try {
              const summary = runningSummary(drafts.current.slice(0, i).filter(Boolean));
              const r2 = await runPass({
                deckId: p.deckId, sectionIndex: i, totalSections: n, section: p.sections[i],
                pass: 2, draft: drafts.current[i], summary, signal: ac.signal,
                onText: (d) => setText(i, (acc += d)),
              });
              outputs.current[i] = r2.text;
              setText(i, r2.text);
              setFinals((f) => f.map((x, j) => (j === i ? true : x)));
              add(r2);
            } catch (e) {
              const err = e instanceof PipelineError ? e : new PipelineError("Something went wrong.", "http");
              if (err.kind === "budget" && err.budget) budgetHit ??= err.budget;
              else hardError ??= { index: i, message: err.kind === "aborted" ? "Stopped. Finished sections are saved." : err.message };
            } finally {
              setActiveAudits((s) => s.filter((x) => x !== i));
            }
          },
          () => budgetHit != null || hardError != null || ac.signal.aborted,
        );

        if (budgetHit) {
          setStop(budgetHit);
          setPhase("budget");
          await finalizeDeck(p.deckId, "budget_exceeded", n);
        } else if (hardError) {
          setError(hardError);
          setPhase("error");
          await finalizeDeck(p.deckId, "failed", n);
        } else if (outputs.current.every(Boolean)) {
          setPhase("done");
          await finalizeDeck(p.deckId, "done", n);
        } else {
          setError({ index: 0, message: "Some sections didn't complete. Retrying picks up only what's left." });
          setPhase("error");
          await finalizeDeck(p.deckId, "failed", n);
        }
        scheduleReconcile(p.deckId);
      } catch (e) {
        // Phase 1 errors land here (it isn't wrapped by runWithConcurrency's own handling).
        setActiveGenerate(null);
        const err = e instanceof PipelineError ? e : new PipelineError("Something went wrong.", "http");
        if (err.kind === "budget" && err.budget) {
          setStop(err.budget);
          setPhase("budget");
          await finalizeDeck(p.deckId, "budget_exceeded", n);
        } else {
          setError({ index: at, message: err.kind === "aborted" ? "Stopped. Finished sections are saved." : err.message });
          setPhase("error");
          await finalizeDeck(p.deckId, "failed", n);
        }
        scheduleReconcile(p.deckId);
      } finally {
        setElapsed(Date.now() - start);
        running.current = false;
      }
    },
    [n, p.deckId, p.sections],
  );

  useEffect(() => {
    if (p.autoStart && !started.current) {
      started.current = true;
      void run();
    }
  }, [p.autoStart, run]);

  async function continueRun() {
    setContinuing(true);
    setContinueError(null);
    try {
      await continueBudget(p.deckId); // raises the cap one tier on the server
    } catch (e) {
      setContinueError(e instanceof Error ? e.message : "Could not continue.");
      setContinuing(false);
      return;
    }
    setContinuing(false);
    void run();
  }

  const draftedCount = drafted.filter(Boolean).length;
  const doneCount = finals.filter(Boolean).length;
  const progress = useMemo(() => {
    // Each section contributes up to two half-points: one for a saved draft, one for the audit.
    const points = drafted.reduce((sum, d, i) => sum + (finals[i] ? 1 : d ? 0.5 : 0), 0);
    return n ? Math.min(1, points / n) : 0;
  }, [drafted, finals, n]);

  const markdown = texts.filter((t) => t.trim()).join("\n\n");
  const box = "rounded-lg border px-4 py-4 text-sm";
  const primary = "rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-fg transition hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
  const ghost = "rounded-lg border border-line px-4 py-2 text-sm font-medium transition hover:border-accent";

  const statusLine =
    phase === "generating"
      ? `Generating section ${(activeGenerate ?? 0) + 1} of ${n}`
      : phase === "auditing"
        ? `Auditing${activeAudits.length > 1 ? ` ${activeAudits.length} sections at once` : ""} · ${doneCount} of ${n} done`
        : `${doneCount} of ${n} sections complete`;

  return (
    <OutputView
      program={p.program}
      module={p.module}
      className={p.className}
      source={p.source}
      markdown={markdown}
      stats={stats}
      inrRate={p.inrRate}
      budget={p.budget}
      elapsedMs={elapsed}
      running={phase === "generating" || phase === "auditing"}
      filenameBase={slug(`${p.module}-${p.className}`)}
      deckId={p.deckId}
      generationDone={phase === "done"}
      reviewStatus={reviewStatus}
      onReviewStatusChange={setReviewStatus}
    >
      {phase !== "done" || n > 1 ? (
        <div className="rounded-xl border border-line bg-surface p-4">
          <div className="flex items-center justify-between text-sm">
            <p className="flex items-center gap-2 font-medium">
              {(phase === "generating" || phase === "auditing") && <Spinner className="h-4 w-4 text-primary" />}
              {statusLine}
            </p>
            {(phase === "generating" || phase === "auditing") && (
              <button type="button" className={ghost} onClick={() => abort.current?.abort()}>Stop</button>
            )}
          </div>
          <div
            role="progressbar"
            aria-label="Cue cards progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            className="mt-4 h-2 overflow-hidden rounded-full bg-line"
          >
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progress * 100}%` }} />
          </div>
          <ol className="mt-4 flex flex-wrap gap-2" aria-label="Sections">
            {p.sections.map((_, i) => {
              const state = finals[i]
                ? "done"
                : error?.index === i && phase === "error"
                  ? "error"
                  : activeAudits.includes(i)
                    ? "auditing"
                    : activeGenerate === i
                      ? "generating"
                      : drafted[i]
                        ? "drafted"
                        : "todo";
              const cls = {
                done: "bg-primary text-primary-fg",
                error: "bg-danger text-primary-fg",
                auditing: "border border-accent text-brand animate-pulse",
                generating: "border border-accent text-brand animate-pulse",
                drafted: "border border-line bg-background text-foreground",
                todo: "border border-line text-muted",
              }[state];
              const title = { done: "audited", error: "failed", auditing: "auditing now", generating: "generating now", drafted: "drafted, waiting to be audited", todo: "not started" }[state];
              return (
                <li key={i} title={`Section ${i + 1}: ${title}`} className={`flex h-6 min-w-6 items-center justify-center rounded px-1 text-[11px] font-medium ${cls}`}>
                  {i + 1}
                </li>
              );
            })}
          </ol>
          {phase === "auditing" && (
            <p className="mt-3 text-xs text-muted">{draftedCount} of {n} generated · {doneCount} of {n} audited</p>
          )}
        </div>
      ) : null}

      {phase === "done" && (
        <div role="status" className={`${box} border-ok bg-ok-soft text-ok`}>
          ✓ All {n} section{n === 1 ? "" : "s"} complete. Use Copy all or Download .md, then paste into HackMD.
        </div>
      )}

      {phase === "budget" && stop && (
        <div role="alert" className={`${box} border-warn bg-warn-soft`}>
          <p className="font-semibold text-warn">⚠ Paused at the {usd(stop.budget)} limit</p>
          <p className="mt-2">
            {doneCount === 0 ? "No sections have finished." : `Sections ${finals.map((f, i) => (f ? i + 1 : null)).filter(Boolean).join(", ")} of ${n} are complete and saved.`}{" "}
            Spent {usd(stop.spent)} ({inr(stop.spent, p.inrRate)}) so far
            {stop.estimate > 0 ? `; the next step is estimated at ${usd(stop.estimate)}` : ""}.
          </p>
          {stop.nextCap != null ? (
            <>
              <p className="mt-2 text-muted">
                Reaching this limit is unusual. Check the script isn&apos;t abnormally long. If you continue, it will
                {stop.nextCap === stop.maxCap ? ` run until ${usd(stop.maxCap)}, which is the absolute maximum.` : ` pause again at ${usd(stop.nextCap)}.`}
              </p>
              {(p.isOwner || continueError) && (
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <button type="button" className={`${primary} inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50`} onClick={() => void continueRun()} disabled={continuing || !p.isOwner}>
                    {continuing && <Spinner />}Continue to {usd(stop.nextCap)}
                  </button>
                  {continueError && <span className="text-danger">{continueError}</span>}
                </div>
              )}
              {!p.isOwner && <p className="mt-2 text-muted">Only the creator of these cue cards, or an admin, can continue them.</p>}
            </>
          ) : (
            <p className="mt-2 font-medium">
              {usd(stop.maxCap)} is the maximum for one set of cue cards, so this can&apos;t continue. Finished sections are saved. Put the rest of the script into a new set of cue cards to keep going.
            </p>
          )}
        </div>
      )}

      {phase === "error" && error && (
        <div role="alert" className={`${box} border-danger bg-danger-soft`}>
          <p className="font-semibold text-danger">✕ Section {error.index + 1} failed</p>
          <p className="mt-1">{error.message}</p>
          <p className="mt-1 text-muted">Finished sections are saved. Retrying picks up only what&apos;s left.</p>
          <button type="button" className={`${primary} mt-4`} onClick={() => void run()}>Retry</button>
        </div>
      )}

      {phase === "idle" && p.isOwner && (
        <div className={`${box} border-line bg-surface`}>
          <p>{doneCount} of {n} sections are complete. These cue cards were not finished.</p>
          <button type="button" className={`${primary} mt-4`} onClick={() => void run()}>
            {doneCount === 0 && draftedCount === 0 ? "Start generating" : "Resume"}
          </button>
        </div>
      )}
    </OutputView>
  );
}
