import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  deckSpend,
  finishGeneration,
  getDeck,
  insertGeneration,
  releaseBudgetReservation,
  reserveBudget,
  saveDraft,
  saveSection,
  setDeckStatus,
} from "@/lib/decks";
import { budgetTiers, capAt, nextCapAfter } from "@/lib/budget";
import { stripOuterFence } from "@/lib/cards";
import { llmModel, streamChat } from "@/lib/openrouter";
import { estimateCall } from "@/lib/pricing";
import { pass1Prompt, pass2Prompt } from "@/lib/prompts";
import { loadSopBlocks, SopMissingError } from "@/lib/sop/load";
import type { InputType } from "@/lib/parsers";

// One section, one pass per call, so no call comes near Vercel Hobby's 300s ceiling.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const MAX_SECTION_INPUT = 24_000;
const MAX_DRAFT_INPUT = 80_000;

const line = (o: unknown) => JSON.stringify(o) + "\n";

/**
 * POST { sectionIndex, totalSections, section, pass: 1|2, draft?, summary? }
 * Streams NDJSON: {t:"text",d} ... {t:"done",usage,spent,budget} | {t:"error",message}.
 * Refuses with 402 (before any spend) when spent + reserved + estimate would pass the cap in
 * force. The cap is raised one tier at a time by POST /continue; the last tier is an absolute
 * maximum. The check is a reservation (see lib/decks.ts::reserveBudget), not a plain read, because
 * the audit phase runs several sections' calls at once — a plain "read spend, then decide" check
 * would let concurrent calls each pass individually and collectively overshoot the cap.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireUser();
  if (guard.error) return guard.error;
  const { user } = guard;

  const deck = await getDeck(params.id);
  // Same response for missing and not-yours, so ids can't be probed.
  if (!deck || (deck.created_by !== user.email && !user.isAdmin)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const b = await req.json().catch(() => null);
  const sectionIndex = Number(b?.sectionIndex);
  const totalSections = Number(b?.totalSections);
  const pass = b?.pass === 1 || b?.pass === 2 ? (b.pass as 1 | 2) : null;
  const section = typeof b?.section === "string" ? b.section : "";
  const draft = typeof b?.draft === "string" ? b.draft : "";
  const summary = typeof b?.summary === "string" ? b.summary.slice(0, 2_000) : "";

  if (
    !pass ||
    !Number.isInteger(sectionIndex) || sectionIndex < 0 ||
    !Number.isInteger(totalSections) || totalSections < 1 || sectionIndex >= totalSections ||
    !section.trim() || section.length > MAX_SECTION_INPUT ||
    draft.length > MAX_DRAFT_INPUT || (pass === 2 && !draft.trim())
  ) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  let sop;
  try {
    sop = loadSopBlocks(deck.input_type as InputType);
  } catch (err) {
    if (err instanceof SopMissingError) return NextResponse.json({ error: err.message }, { status: 500 });
    throw err;
  }

  // Budget guard: a lightweight (non-atomic) read decides the cache-hit heuristic for the cost
  // estimate only — being slightly stale there just makes the estimate a little off, never unsafe.
  // The actual pass/fail decision is the atomic reservation right after.
  const tiers = budgetTiers();
  const budget = capAt(tiers, deck.budget_tier);
  const heuristicSpent = await deckSpend(deck.id);
  const estimate = estimateCall(pass, section.length, sop.tokens, heuristicSpent > 0);

  const { reserved, spent } = await reserveBudget(deck.id, estimate, budget);
  if (!reserved) {
    await setDeckStatus(deck.id, "budget_exceeded");
    return NextResponse.json(
      { error: "budget_exceeded", spent, estimate, budget, nextCap: nextCapAfter(tiers, deck.budget_tier), maxCap: tiers[tiers.length - 1], sectionIndex, pass },
      { status: 402 },
    );
  }
  if (deck.status === "budget_exceeded") await setDeckStatus(deck.id, "pending");

  const userPrompt =
    pass === 1
      ? pass1Prompt({ className: deck.class_name, program: deck.program, module: deck.module, index: sectionIndex, total: totalSections, section, summary })
      : pass2Prompt({ program: deck.program, module: deck.module, section, draft, summary });

  const model = llmModel();
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(encoder.encode(line(o)));
      let rowId: string | null = null;
      let text = "";
      try {
        // Pass 2 is a bounded check-against-rules task, not open-ended drafting, so it needs less
        // extended thinking than Pass 1 — "low" cuts thinking tokens (billed as output, the priciest
        // rate) without changing what the audit is asked to do. Pass 1 keeps LLM_REASONING_EFFORT.
        const reasoningEffort = pass === 2 ? "low" : undefined;
        for await (const ev of streamChat({ system: sop.blocks, user: userPrompt, reasoningEffort, signal: req.signal })) {
          if (ev.type === "id") {
            // Record immediately: if the connection drops mid-stream the call is still billed,
            // and the reconcile job can fill in the cost from this id.
            rowId = await insertGeneration({
              deckId: deck.id,
              sectionIndex,
              pass,
              model,
              openrouterId: ev.openrouterId,
            });
          } else if (ev.type === "text") {
            text += ev.delta;
            send({ t: "text", d: ev.delta });
          } else {
            if (rowId) await finishGeneration(rowId, ev.usage);
            // Strip a whole-reply ```markdown fence here, once, so both what's persisted and what
            // the client displays (via the `text` below) are already clean — see lib/cards.ts.
            text = stripOuterFence(text);
            // Pass 1's draft is saved too (not just Pass 2's audited output), so a budget pause or
            // crash between the generate and audit phases never forces an already-paid-for Pass 1
            // call to be redone on resume.
            if (pass === 1) await saveDraft(deck.id, sectionIndex, text);
            else await saveSection(deck.id, sectionIndex, text);
            send({ t: "done", usage: ev.usage, spent: await deckSpend(deck.id), budget, text });
          }
        }
      } catch (err) {
        console.error("generate failed", { deck: deck.id, sectionIndex, pass, err });
        send({ t: "error", message: err instanceof Error ? err.message : "Generation failed" });
      } finally {
        controller.close();
        // Always release, whatever happened: the reservation was only ever a temporary hold for
        // concurrency safety — the real cost, if any, is already committed via finishGeneration.
        await releaseBudgetReservation(deck.id, estimate).catch((e) => console.error("release reservation failed", e));
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
