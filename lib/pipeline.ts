// Browser-side driver for one pass over one section. The server route does the LLM call,
// budget check and persistence; this just streams the NDJSON response back to the UI.
import type { Usage } from "@/lib/usage";

export type BudgetStop = {
  spent: number;
  estimate: number; // 0 when unknown (e.g. reopening a paused set of cue cards)
  budget: number; // the cap that was hit
  nextCap: number | null; // null once at the maximum
  maxCap: number;
  sectionIndex: number;
  pass: 1 | 2;
};

export class PipelineError extends Error {
  constructor(
    message: string,
    public kind: "budget" | "http" | "stream" | "aborted",
    public budget?: BudgetStop,
  ) {
    super(message);
  }
}

export type PassArgs = {
  deckId: string;
  sectionIndex: number;
  totalSections: number;
  section: string;
  pass: 1 | 2;
  draft?: string;
  summary?: string;
  signal?: AbortSignal;
  onText: (delta: string) => void;
};

export type PassResult = { text: string; usage: Usage; spent: number };

export async function runPass(a: PassArgs): Promise<PassResult> {
  let res: Response;
  try {
    res = await fetch(`/api/decks/${a.deckId}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: a.signal,
      body: JSON.stringify({
        sectionIndex: a.sectionIndex,
        totalSections: a.totalSections,
        section: a.section,
        pass: a.pass,
        draft: a.draft,
        summary: a.summary,
      }),
    });
  } catch {
    if (a.signal?.aborted) throw new PipelineError("Stopped", "aborted");
    throw new PipelineError("Network error. Check your connection and retry.", "http");
  }

  if (res.status === 402) {
    const b = await res.json();
    throw new PipelineError("Budget cap reached", "budget", b);
  }
  if (!res.ok || !res.body) {
    const b = await res.json().catch(() => ({}));
    throw new PipelineError(b.error ?? `Request failed (${res.status})`, "http");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let done: { usage: Usage; spent: number; text?: string } | null = null;
  try {
    for (;;) {
      const { value, done: finished } = await reader.read();
      if (finished) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        const ev = JSON.parse(line);
        if (ev.t === "text") {
          text += ev.d;
          a.onText(ev.d);
        } else if (ev.t === "done") done = { usage: ev.usage, spent: ev.spent, text: ev.text };
        else if (ev.t === "error") throw new PipelineError(ev.message, "stream");
      }
    }
  } catch (err) {
    if (err instanceof PipelineError) throw err;
    if (a.signal?.aborted) throw new PipelineError("Stopped", "aborted");
    throw new PipelineError("Connection dropped mid-section.", "stream");
  }
  if (!done) throw new PipelineError("Connection dropped mid-section.", "stream");
  // Prefer the server's final text (fence-stripped, and what actually got saved) over our own
  // delta accumulation, so a live "done" section always matches what a reload would show.
  return { text: done.text ?? text, usage: done.usage, spent: done.spent };
}

export async function finalizeDeck(deckId: string, status: "done" | "failed" | "budget_exceeded", total: number) {
  await fetch(`/api/decks/${deckId}/finalize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, totalSections: total }),
  }).catch(() => undefined);
}

/** Settles costs from OpenRouter shortly after a run; best effort. */
export function scheduleReconcile(deckId: string, delayMs = 20_000) {
  setTimeout(() => {
    fetch(`/api/decks/${deckId}/reconcile`, { method: "POST" }).catch(() => undefined);
  }, delayMs);
}

/** Best-effort: warms the SOP+example cache before the real calls start. Never throws. */
export function prewarmCache(deckId: string): Promise<void> {
  return fetch(`/api/decks/${deckId}/prewarm`, { method: "POST" }).then(
    () => undefined,
    () => undefined,
  );
}

/** The user's explicit "continue" after a budget pause: raises the cap one tier on the server. */
export async function continueBudget(deckId: string): Promise<{ cap: number; nextCap: number | null }> {
  const res = await fetch(`/api/decks/${deckId}/continue`, { method: "POST" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new PipelineError(body.error ?? "Could not continue.", "http");
  return body;
}
