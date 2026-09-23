import "server-only";
import type { DeckStat } from "@/lib/admin-stats";
import { stripOuterFence } from "@/lib/cards";
import { db } from "@/lib/db";

const PAGE = 1000; // Supabase returns at most 1000 rows per request

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

type DeckMeta = {
  id: string; program: string; module: string; module_normalized: string; class_name: string;
  created_by: string; created_at: string; finished_at: string | null; status: DeckStat["status"]; budget_tier: number;
  review_status: "draft" | "completed";
};
type CostRow = {
  deck_id: string; input_tokens: number; output_tokens: number; cached_tokens: number;
  cached_pct: number; total_cost_usd: number;
};

/** Decks joined with their derived cost. Pass an email to limit to one owner. */
export async function deckStats(owner?: string): Promise<DeckStat[]> {
  const decks = await fetchAll<DeckMeta>((from, to) => {
    let q = db()
      .from("decks")
      .select("id, program, module, module_normalized, class_name, created_by, created_at, finished_at, status, budget_tier, review_status")
      .order("created_at", { ascending: false })
      .range(from, to);
    if (owner) q = q.eq("created_by", owner);
    return q;
  });
  const costs = new Map<string, CostRow>();
  for (const c of await fetchAll<CostRow>((from, to) => db().from("deck_costs").select("*").range(from, to))) {
    costs.set(c.deck_id, c);
  }
  return decks.map((d) => {
    const c = costs.get(d.id);
    return {
      id: d.id, program: d.program, module: d.module, moduleNormalized: d.module_normalized,
      className: d.class_name, createdBy: d.created_by, createdAt: d.created_at, finishedAt: d.finished_at, status: d.status, tier: d.budget_tier ?? 0,
      reviewStatus: d.review_status ?? "draft",
      inputTokens: Number(c?.input_tokens ?? 0), outputTokens: Number(c?.output_tokens ?? 0),
      cachedTokens: Number(c?.cached_tokens ?? 0), cachedPct: Number(c?.cached_pct ?? 0),
      costUsd: Number(c?.total_cost_usd ?? 0),
    };
  });
}

export type DeckDetail = {
  id: string; createdBy: string; createdAt: string; program: string; module: string; className: string;
  inputType: string; status: DeckStat["status"]; budgetTier: number; source: string; output: string;
  reviewStatus: DeckStat["reviewStatus"];
  finishedAt: string | null;
  /** A manual edit saved from the in-app validator, if any — takes over as the source of truth for display when present. See lib/decks.ts::saveEditedOutput. */
  editedOutput: string | null;
  /** `draft` is Pass 1's output (may exist even when `output`, the audited version, doesn't yet). */
  sections: { index: number; draft: string; output: string }[];
  cost: { inputTokens: number; outputTokens: number; cachedTokens: number; costUsd: number };
};

export async function getDeckDetail(id: string): Promise<DeckDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data: d, error } = await db()
    .from("decks")
    .select("id, created_by, created_at, finished_at, program, module, class_name, input_type, status, budget_tier, review_status, source_md, output_md, edited_output_md")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!d) return null;
  // Errors from either query are NOT ignorable here: decks.output_md (already fetched above) can
  // hold a deck's real, finished content even when this second query fails — silently treating
  // that failure as "no sections" would show a finished deck as if it had never been generated,
  // while its actual output sits untouched in the row we already have. Fail loudly instead.
  const [secsRes, costRes] = await Promise.all([
    db().from("deck_sections").select("section_index, draft_md, output_md").eq("deck_id", id).order("section_index"),
    db().from("deck_costs").select("*").eq("deck_id", id).maybeSingle(),
  ]);
  if (secsRes.error) throw secsRes.error;
  if (costRes.error) throw costRes.error;
  const secs = secsRes.data;
  const c = costRes.data;
  return {
    id: d.id, createdBy: d.created_by, createdAt: d.created_at, program: d.program, module: d.module,
    className: d.class_name, inputType: d.input_type, status: d.status, budgetTier: d.budget_tier ?? 0,
    reviewStatus: d.review_status ?? "draft",
    finishedAt: d.finished_at,
    editedOutput: d.edited_output_md != null ? stripOuterFence(d.edited_output_md) : null,
    source: d.source_md, output: stripOuterFence(d.output_md),
    // Defensive: covers cue cards saved before this fix. New runs are already clean at write time.
    sections: (secs ?? []).map((s) => ({
      index: s.section_index,
      draft: stripOuterFence(s.draft_md ?? ""),
      output: stripOuterFence(s.output_md),
    })),
    cost: {
      inputTokens: Number(c?.input_tokens ?? 0), outputTokens: Number(c?.output_tokens ?? 0),
      cachedTokens: Number(c?.cached_tokens ?? 0), costUsd: Number(c?.total_cost_usd ?? 0),
    },
  };
}

/** Saved module names for a Program, A to Z. Falls back to names used on past cue cards if migration 0005 isn't applied. */
export async function listModules(program: string): Promise<string[]> {
  const saved = await db().from("modules").select("name").eq("program", program).order("name");
  if (!saved.error) return (saved.data ?? []).map((r) => r.name);

  const { data, error } = await db()
    .from("decks")
    .select("module, module_normalized")
    .eq("program", program)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  const seen = new Map<string, string>();
  for (const r of data ?? []) if (!seen.has(r.module_normalized)) seen.set(r.module_normalized, r.module);
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

export async function listGenerations(deckId: string) {
  const { data, error } = await db()
    .from("generations")
    .select("id, section_index, pass, model, openrouter_id, input_tokens, output_tokens, cached_tokens, cost_usd, reconciled, created_at")
    .eq("deck_id", deckId)
    .order("section_index")
    .order("pass")
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((g) => ({ ...g, cost_usd: Number(g.cost_usd) }));
}

export async function listUsers(): Promise<{ email: string; name: string | null }[]> {
  return fetchAll<{ email: string; name: string | null }>((from, to) =>
    db().from("users").select("email, name").range(from, to),
  );
}
