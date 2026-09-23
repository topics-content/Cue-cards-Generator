// ONE-OFF, OPTIONAL. Not run automatically. Re-estimates `cost_usd` for generation rows that were
// recorded as $0 because of the BYOK cost bug fixed in lib/openrouter.ts (the OpenRouter fee is
// $0 under BYOK's free allowance; the real cost is the provider's own charge, which this bug never
// read). Their real OpenRouter /generation records have already expired, so this recomputes an
// ESTIMATE from the token counts already stored (which were captured correctly) and the rates in
// lib/pricing.ts. It only ever touches rows with cost_usd = 0 AND reconciled = true (i.e. rows
// this bug produced), so it cannot overwrite a real, correctly-recorded cost.
//
// Run: npx tsx --env-file=.env.local scripts/backfill-byok-cost.ts            (dry run, prints only)
//      npx tsx --env-file=.env.local scripts/backfill-byok-cost.ts --apply    (writes the estimates)
import { PostgrestClient } from "@supabase/postgrest-js";
import { ratesFor } from "../lib/pricing";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const db = new PostgrestClient(`${url}/rest/v1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });

const apply = process.argv.includes("--apply");

async function main() {
  const { data: rows, error } = await db
    .from("generations")
    .select("id, deck_id, model, input_tokens, output_tokens, cached_tokens")
    .eq("cost_usd", 0)
    .eq("reconciled", true);
  if (error) throw error;
  if (!rows?.length) {
    console.log("No zero-cost reconciled rows found. Nothing to do.");
    return;
  }

  let total = 0;
  for (const r of rows) {
    const R = ratesFor(r.model);
    const fresh = Math.max(0, r.input_tokens - r.cached_tokens);
    const estimate = fresh * R.input + r.cached_tokens * R.cacheRead + r.output_tokens * R.output;
    total += estimate;
    console.log(`${apply ? "writing" : "would write"} ${r.id.slice(0, 8)} (deck ${r.deck_id.slice(0, 8)}): $${estimate.toFixed(6)}`);
    if (apply) {
      const { error: e2 } = await db.from("generations").update({ cost_usd: estimate }).eq("id", r.id);
      if (e2) throw e2;
    }
  }
  console.log(`\n${rows.length} row(s), estimated total $${total.toFixed(4)}.`);
  if (!apply) console.log("Dry run only. Re-run with --apply to write these estimates.");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
