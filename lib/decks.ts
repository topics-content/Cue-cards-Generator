import "server-only";
import { db } from "@/lib/db";
import type { Usage } from "@/lib/usage";

export { PROGRAMS } from "@/lib/programs";

/** "React  Basics " and "react basics" must group together. */
export const normalizeModule = (m: string) => m.trim().replace(/\s+/g, " ").toLowerCase();

export type DeckRow = {
  id: string;
  created_by: string;
  status: "pending" | "done" | "failed" | "budget_exceeded";
  class_name: string;
  input_type: string;
  budget_tier: number;
};

export type ReviewStatus = "draft" | "completed";

/**
 * Saves the module for this Program (first spelling wins) and returns the canonical name, so
 * "react basics" typed later reuses "React Basics". If the modules table isn't there yet
 * (migration 0005 not run) it falls back to the typed name instead of blocking the user.
 */
async function canonicalModule(program: string, name: string, createdBy: string): Promise<string> {
  const display = name.trim().replace(/\s+/g, " ");
  const normalized = normalizeModule(display);
  try {
    const { error } = await db()
      .from("modules")
      .upsert({ program, name: display, name_normalized: normalized, created_by: createdBy }, { onConflict: "program,name_normalized", ignoreDuplicates: true });
    if (error) throw error;
    const { data, error: e2 } = await db().from("modules").select("name").eq("program", program).eq("name_normalized", normalized).maybeSingle();
    if (e2) throw e2;
    return data?.name ?? display;
  } catch (err) {
    console.warn("modules table unavailable; using the typed module name", err);
    return display;
  }
}

export async function createDeck(d: {
  createdBy: string;
  program: string;
  module: string;
  className: string;
  inputType: string;
  model: string;
  sourceChars: number;
  sourceMd: string;
}): Promise<{ id: string; module: string }> {
  const moduleName = await canonicalModule(d.program, d.module, d.createdBy);
  const { data, error } = await db()
    .from("decks")
    .insert({
      created_by: d.createdBy,
      program: d.program,
      module: moduleName,
      module_normalized: normalizeModule(moduleName),
      class_name: d.className.trim(),
      input_type: d.inputType,
      model: d.model,
      source_chars: d.sourceChars,
      source_md: d.sourceMd,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id, module: moduleName };
}

export async function getDeck(id: string): Promise<DeckRow | null> {
  const { data, error } = await db()
    .from("decks")
    .select("id, created_by, status, class_name, input_type, budget_tier")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function setDeckStatus(id: string, status: DeckRow["status"]) {
  const { error } = await db().from("decks").update({ status }).eq("id", id);
  if (error) throw error;
}

/** Only what the review-gate route needs: enough to check ownership, generation status, and re-run the validator on the real saved output. */
export async function getDeckForReview(
  id: string,
): Promise<{ id: string; created_by: string; status: DeckRow["status"]; review_status: ReviewStatus; output_md: string } | null> {
  const { data, error } = await db()
    .from("decks")
    .select("id, created_by, status, review_status, output_md")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Sets whether a person has verified these cue cards. Only ever called after the caller itself
 * re-validated output_md (see /api/decks/[id]/complete) — never trusts a client-reported "it's
 * clean" — so this function does no validation of its own, just the write.
 */
export async function setReviewStatus(id: string, status: ReviewStatus) {
  const { error } = await db().from("decks").update({ review_status: status }).eq("id", id);
  if (error) throw error;
}

/** Total spend so far, derived from generation rows (the deck_costs view). */
export async function deckSpend(id: string): Promise<number> {
  const { data, error } = await db()
    .from("deck_costs")
    .select("total_cost_usd")
    .eq("deck_id", id)
    .maybeSingle();
  if (error) throw error;
  return Number(data?.total_cost_usd ?? 0);
}

/**
 * Atomically checks spent + already-reserved + this call's estimate against the cap and, if it
 * fits, reserves it — via a Postgres function that locks the deck row (see migration 0006), so
 * concurrent calls for the same deck (the audit phase runs several at once) can't each pass a
 * stale check and collectively overshoot. Always pair with releaseBudgetReservation once the call
 * this reservation was for has finished, success or not.
 */
export async function reserveBudget(
  deckId: string,
  amount: number,
  budget: number,
): Promise<{ reserved: boolean; spent: number; reservedTotal: number }> {
  const { data, error } = await db()
    .rpc("reserve_budget", { p_deck_id: deckId, p_amount: amount, p_budget: budget })
    .single();
  if (error) throw error;
  const row = data as { reserved: boolean; spent: number; reserved_total: number };
  return { reserved: row.reserved, spent: Number(row.spent), reservedTotal: Number(row.reserved_total) };
}

export async function releaseBudgetReservation(deckId: string, amount: number): Promise<void> {
  const { error } = await db().rpc("release_budget_reservation", { p_deck_id: deckId, p_amount: amount });
  if (error) throw error;
}

/** Inserted as soon as OpenRouter returns an id, so a dropped stream is still billed and reconcilable. */
export async function insertGeneration(g: {
  deckId: string;
  sectionIndex: number;
  pass: 1 | 2;
  model: string;
  openrouterId: string;
}): Promise<string> {
  const { data, error } = await db()
    .from("generations")
    .insert({
      deck_id: g.deckId,
      section_index: g.sectionIndex,
      pass: g.pass,
      model: g.model,
      openrouter_id: g.openrouterId,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function finishGeneration(rowId: string, u: Usage) {
  const { error } = await db()
    .from("generations")
    .update({
      input_tokens: u.inputTokens,
      output_tokens: u.outputTokens,
      cached_tokens: u.cachedTokens,
      cost_usd: u.costUsd,
    })
    .eq("id", rowId);
  if (error) throw error;
}

/** Pass 1's draft, saved as soon as it's ready so a pause before the audit phase never loses it. */
export async function saveDraft(deckId: string, index: number, markdown: string) {
  const { error } = await db()
    .from("deck_sections")
    .upsert(
      { deck_id: deckId, section_index: index, draft_md: markdown, updated_at: new Date().toISOString() },
      { onConflict: "deck_id,section_index" },
    );
  if (error) throw error;
}

/** The audited final output for a section. */
export async function saveSection(deckId: string, index: number, markdown: string) {
  const { error } = await db()
    .from("deck_sections")
    .upsert(
      { deck_id: deckId, section_index: index, output_md: markdown, updated_at: new Date().toISOString() },
      { onConflict: "deck_id,section_index" },
    );
  if (error) throw error;
}

/** Section indexes with a saved *draft* (Pass 1 done) — resume can skip generating these again. */
export async function draftedSectionIndexes(deckId: string): Promise<number[]> {
  const { data, error } = await db()
    .from("deck_sections")
    .select("section_index")
    .eq("deck_id", deckId)
    .not("draft_md", "is", null)
    .order("section_index");
  if (error) throw error;
  return data.map((r) => r.section_index);
}

/** Section indexes with a saved, *audited* output (Pass 2 done) — the only ones a finished deck can count on. */
export async function completedSectionIndexes(deckId: string): Promise<number[]> {
  const { data, error } = await db()
    .from("deck_sections")
    .select("section_index")
    .eq("deck_id", deckId)
    .not("output_md", "eq", "")
    .order("section_index");
  if (error) throw error;
  return data.map((r) => r.section_index);
}

/** Joins audited sections in order into decks.output_md and sets the final status. Un-audited (draft-only) sections are left out. */
export async function finalizeDeck(deckId: string, status: DeckRow["status"]) {
  const { data, error } = await db()
    .from("deck_sections")
    .select("output_md")
    .eq("deck_id", deckId)
    .not("output_md", "eq", "")
    .order("section_index");
  if (error) throw error;
  const output = data.map((r) => r.output_md.trim()).join("\n\n");
  // Any reservation left over (e.g. a call that never got to release, on a crash) can't outlive the run.
  // finished_at is overwritten on every call, including a later resume's completion — it tracks
  // "when this run last stopped", which is what "time taken" on the observatory table means.
  const { error: e2 } = await db()
    .from("decks")
    .update({ output_md: output, status, reserved_usd: 0, finished_at: new Date().toISOString() })
    .eq("id", deckId);
  if (e2) throw e2;
  return output;
}

/**
 * Raises the spend cap by one tier and resumes. Conditional on the tier the caller saw, so a
 * double click can't skip a tier. Returns the tier now in force.
 */
export async function bumpBudgetTier(id: string, fromTier: number, maxTier: number): Promise<number> {
  if (fromTier >= maxTier) return fromTier;
  const { data, error } = await db()
    .from("decks")
    .update({ budget_tier: fromTier + 1, status: "pending" })
    .eq("id", id)
    .eq("budget_tier", fromTier)
    .select("budget_tier")
    .maybeSingle();
  if (error) throw error;
  return data?.budget_tier ?? fromTier + 1; // already bumped by a concurrent click
}
