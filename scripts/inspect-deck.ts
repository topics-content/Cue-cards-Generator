// Read-only debug: prints the decks + generations rows for the most recent set of cue cards.
// Run: npx tsx --env-file=.env.local scripts/inspect-deck.ts
import { PostgrestClient } from "@supabase/postgrest-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const db = () => new PostgrestClient(`${url}/rest/v1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });

async function main() {
  const { data: decks, error } = await db()
    .from("decks")
    .select("id, class_name, module, program, status, budget_tier, model, created_at")
    .order("created_at", { ascending: false })
    .limit(3);
  if (error) throw error;
  for (const d of decks ?? []) {
    console.log("\n=== deck", d.id, d.class_name, "status:", d.status, "model:", d.model, "created:", d.created_at);
    const { data: gens, error: e2 } = await db()
      .from("generations")
      .select("id, section_index, pass, model, openrouter_id, input_tokens, output_tokens, cached_tokens, cost_usd, reconciled, created_at")
      .eq("deck_id", d.id)
      .order("section_index")
      .order("pass");
    if (e2) throw e2;
    console.table((gens ?? []).map((g) => ({ ...g, id: g.id.slice(0, 8), openrouter_id: g.openrouter_id?.slice(0, 20) })));
    const { data: cost } = await db().from("deck_costs").select("*").eq("deck_id", d.id).maybeSingle();
    console.log("deck_costs view row:", cost);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
