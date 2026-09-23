"use client";
import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ModuleCombobox } from "@/components/ModuleCombobox";
import { DeckRunner } from "@/components/DeckRunner";
import { Spinner } from "@/components/Spinner";
import { inr, tokens, usd } from "@/lib/format";
import { PROGRAMS } from "@/lib/programs";

type Parsed = {
  text: string;
  inputType: "ipynb" | "md" | "docx" | "gdoc";
  imageCount: number;
  chars: number;
  estimatedTokens: number;
  sections: string[];
  estimate: { costUsd: number };
  budget: number;
  maxBudget: number;
  tiers: number[];
  overBudget: boolean;
  sopMissing: string | null;
};

type Run = { deckId: string; program: string; module: string; className: string; parsed: Parsed };

const field =
  "w-full rounded-lg border border-line bg-surface px-4 py-2 text-sm text-foreground placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";
const label = "mb-2 block text-sm font-medium";

export function NewDeck({ inrRate }: { inrRate: number }) {
  const [program, setProgram] = useState("");
  const [moduleName, setModuleName] = useState("");
  const [className, setClassName] = useState("");
  const [modules, setModules] = useState<string[]>([]);
  const [modulesLoading, setModulesLoading] = useState(false);
  const [mode, setMode] = useState<"file" | "gdoc">("file");
  const [url, setUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [run, setRun] = useState<Run | null>(null);
  const [confirmOver, setConfirmOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setModules([]);
    if (!program) return;
    let live = true;
    setModulesLoading(true);
    fetch(`/api/modules?program=${encodeURIComponent(program)}`)
      .then((r) => (r.ok ? r.json() : { modules: [] }))
      .then((d) => live && setModules(d.modules ?? []))
      .catch(() => undefined)
      .finally(() => live && setModulesLoading(false));
    return () => {
      live = false;
    };
  }, [program]);

  async function parse(body: FormData) {
    setParsing(true);
    setError(null);
    setParsed(null);
    try {
      const res = await fetch("/api/parse", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not read that script.");
      setParsed(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that script.");
    } finally {
      setParsing(false);
    }
  }

  const onFile = (f: File | undefined) => {
    if (!f) return;
    setFileName(f.name);
    const fd = new FormData();
    fd.set("file", f);
    void parse(fd);
  };

  const onFetchUrl = () => {
    const fd = new FormData();
    fd.set("url", url);
    void parse(fd);
  };

  async function generate() {
    if (!parsed) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ program, module: moduleName, className, inputType: parsed.inputType, source: parsed.text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not create the cue cards.");
      setRun({ deckId: data.id, program, module: data.module ?? moduleName.trim(), className: className.trim(), parsed });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the cue cards.");
    } finally {
      setCreating(false);
    }
  }

  if (run) {
    return (
      <div>
        <button
          type="button"
          onClick={() => location.reload()}
          className="mb-4 text-sm font-medium text-brand hover:underline"
        >
          ← New cue cards
        </button>
        <DeckRunner
          deckId={run.deckId}
          program={run.program}
          module={run.module}
          className={run.className}
          source={run.parsed.text}
          sections={run.parsed.sections}
          initialDrafts={[]}
          initialOutputs={[]}
          initialStats={{ inputTokens: 0, outputTokens: 0, cachedTokens: 0, costUsd: 0 }}
          initialReviewStatus="draft"
          initialEditedOutput={null}
          initialDurationMs={null}
          inrRate={inrRate}
          budget={run.parsed.budget}
          isOwner
          autoStart
        />
      </div>
    );
  }

  const missing = [!program && "Program", !moduleName.trim() && "Module", !className.trim() && "Class Name", !parsed && "a script"].filter(Boolean);
  const overBudget = !!parsed?.overBudget;
  const sopBlocked = !!parsed?.sopMissing;
  // Over budget only warns (and asks to confirm); a missing SOP is the one thing that truly blocks.
  const canGenerate = missing.length === 0 && !sopBlocked && !creating && !parsing;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">New cue cards</h1>
      <p className="mt-1 text-sm text-muted">Upload a lecture script and generate HackMD cue cards that follow the SOP.</p>

      <div className="mt-6 space-y-6 rounded-xl border border-line bg-surface p-6 sm:p-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="program" className={label}>Program</label>
            <select id="program" className={field} value={program} onChange={(e) => setProgram(e.target.value)}>
              <option value="">Select a program</option>
              {PROGRAMS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="module" className={label}>Module</label>
            <ModuleCombobox id="module" value={moduleName} onChange={setModuleName} options={modules} loading={modulesLoading} disabled={!program} program={program} />
          </div>
        </div>

        <div>
          <label htmlFor="class" className={label}>Class Name</label>
          <input id="class" className={field} value={className} onChange={(e) => setClassName(e.target.value)} placeholder="e.g. Introduction to React" />
        </div>

        <div>
          <span className={label}>Script</span>
          <div role="tablist" aria-label="Script source" className="mb-4 inline-flex overflow-hidden rounded-lg border border-line text-sm font-medium">
            {([["file", "Upload file"], ["gdoc", "Google Doc URL"]] as const).map(([m, t]) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => { setMode(m); setParsed(null); setError(null); }}
                className={`px-4 py-2 transition ${mode === m ? "bg-primary text-primary-fg" : "text-muted hover:text-foreground"}`}
              >
                {t}
              </button>
            ))}
          </div>

          {mode === "file" ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}
              className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line px-4 py-8 text-center"
            >
              <p className="text-sm">{fileName || "Drop a file here, or"}</p>
              <input ref={fileRef} type="file" accept=".ipynb,.md,.markdown,.txt,.docx" className="sr-only" id="file" onChange={(e) => onFile(e.target.files?.[0])} />
              <label htmlFor="file" className="cursor-pointer rounded-lg border border-line px-4 py-2 text-sm font-medium transition hover:border-accent focus-within:outline">
                Choose file
              </label>
              <p className="text-xs text-muted">.ipynb, .md or .docx · up to 4 MB</p>
            </div>
          ) : (
            <div className="flex gap-2">
              <input className={field} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://docs.google.com/document/d/…" aria-label="Google Doc URL" />
              <button type="button" onClick={onFetchUrl} disabled={!url.trim() || parsing} className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-line px-4 text-sm font-medium transition hover:border-accent disabled:opacity-50">
                {parsing && <Spinner className="h-4 w-4" />}Fetch
              </button>
            </div>
          )}
          {parsing && <p className="mt-4 flex items-center gap-2 text-sm text-muted" role="status"><Spinner /> Reading the script…</p>}
        </div>

        {parsed && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-lg bg-background p-4 text-sm sm:grid-cols-4" aria-label="Script summary">
            <div><dt className="text-xs text-muted">Characters</dt><dd className="font-medium tabular-nums">{parsed.chars.toLocaleString()}</dd></div>
            <div><dt className="text-xs text-muted">Est. tokens</dt><dd className="font-medium tabular-nums">{tokens(parsed.estimatedTokens)}</dd></div>
            <div><dt className="text-xs text-muted">Sections</dt><dd className="font-medium tabular-nums">{parsed.sections.length}</dd></div>
            <div>
              <dt className="text-xs text-muted">Est. cost</dt>
              <dd className="font-medium tabular-nums text-brand">{usd(parsed.estimate.costUsd)} <span className="font-normal text-muted">· {inr(parsed.estimate.costUsd, inrRate)}</span></dd>
            </div>
            {parsed.imageCount > 0 && (
              <p className="col-span-full text-xs text-muted">{parsed.imageCount} notebook image{parsed.imageCount === 1 ? "" : "s"} replaced with placeholders. Image data is never sent.</p>
            )}
          </dl>
        )}

        {overBudget && parsed && (
          <p role="status" className="rounded-lg border border-warn bg-warn-soft px-4 py-4 text-sm">
            <strong className="text-warn">⚠ Over the cost limit.</strong> Estimated {usd(parsed.estimate.costUsd)} ({inr(parsed.estimate.costUsd, inrRate)}) is above the {usd(parsed.budget)} limit per set of cue cards. It will pause when spend reaches the limit so you can decide whether to continue, up to {usd(parsed.maxBudget)}.
          </p>
        )}
        {sopBlocked && parsed && (
          <p role="alert" className="rounded-lg border border-warn bg-warn-soft px-4 py-4 text-sm">
            <strong className="text-warn">⚠ Setup incomplete.</strong> {parsed.sopMissing}
          </p>
        )}
        {error && <p role="alert" className="rounded-lg border border-danger bg-danger-soft px-4 py-4 text-sm text-danger">{error}</p>}

        <div className="flex items-center justify-between gap-4 pt-1">
          <p className="text-xs text-muted">{missing.length > 0 ? `Still needed: ${missing.join(", ")}` : "Ready to generate."}</p>
          <button
            type="button"
            onClick={() => (overBudget ? setConfirmOver(true) : void generate())}
            disabled={!canGenerate}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-fg transition hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating && <Spinner />}{creating ? "Starting…" : "Generate cue cards"}
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={confirmOver}
        title="This will breach the cost limit"
        confirmLabel="Generate anyway"
        onCancel={() => setConfirmOver(false)}
        onConfirm={() => {
          setConfirmOver(false);
          void generate();
        }}
      >
        {parsed && (
          <>
            <p>
              Estimated cost is <strong className="text-foreground">{usd(parsed.estimate.costUsd)} ({inr(parsed.estimate.costUsd, inrRate)})</strong>, above the {usd(parsed.budget)} limit for one set of cue cards.
            </p>
            <p>
              The estimate is rough, so the real cost may be lower. Generation pauses at {parsed.tiers.slice(0, -1).map(usd).join(" and ")}, and each time you choose whether to continue. It stops for good at {usd(parsed.maxBudget)}. Finished sections are always kept.
            </p>
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}
