import "server-only";
import { db } from "@/lib/db";
import { fetchGeneration } from "@/lib/openrouter";

const SETTLE_MS = 15_000; // OpenRouter's generation record can lag a few seconds
// Observed: OpenRouter's /generation record can 404 in under 24h (undocumented retention),
// well short of what we first assumed. This is only a safety net anyway — the real cost is
// captured inline from the stream the moment each call finishes (see lib/openrouter.ts), not
// dependent on this record surviving. Kept short so we stop retrying calls that are gone for good.
const GIVE_UP_MS = 20 * 3600_000;

/**
 * Overwrites inline-usage costs with OpenRouter's settled numbers (the billing source of truth).
 * Rows OpenRouter can't find yet are left for the next run; rows older than GIVE_UP_MS stop being retried.
 */
export async function reconcile(opts: { deckId?: string; limit?: number } = {}) {
  const now = Date.now();
  let q = db()
    .from("generations")
    .select("id, openrouter_id, input_tokens, output_tokens, cached_tokens")
    .eq("reconciled", false)
    .not("openrouter_id", "is", null)
    .lt("created_at", new Date(now - SETTLE_MS).toISOString())
    .gt("created_at", new Date(now - GIVE_UP_MS).toISOString())
    .order("created_at")
    .limit(opts.limit ?? 100);
  if (opts.deckId) q = q.eq("deck_id", opts.deckId);
  const { data: rows, error } = await q;
  if (error) throw error;

  let updated = 0;
  let pending = 0;
  let failed = 0;
  for (const row of rows ?? []) {
    try {
      const g = await fetchGeneration(row.openrouter_id);
      if (!g) {
        pending++;
        continue;
      }
      const { error: e } = await db()
        .from("generations")
        .update({
          cost_usd: g.costUsd,
          // A call whose stream dropped has no inline usage; fill tokens from the settled record.
          ...(row.input_tokens === 0 ? { input_tokens: g.inputTokens, output_tokens: g.outputTokens } : {}),
          ...(row.cached_tokens === 0 && g.cachedTokens ? { cached_tokens: g.cachedTokens } : {}),
          reconciled: true,
        })
        .eq("id", row.id);
      if (e) throw e;
      updated++;
    } catch (err) {
      failed++;
      console.error("reconcile failed", row.openrouter_id, err);
    }
  }
  return { checked: rows?.length ?? 0, updated, pending, failed };
}
