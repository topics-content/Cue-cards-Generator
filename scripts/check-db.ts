// Read-only check that your Supabase project has every migration applied.
// Run: npm run check:db   (uses NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local)
import { PostgrestClient } from "@supabase/postgrest-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing in .env.local");
  process.exit(1);
}
if (/\/rest\/v1\/?$/.test(url)) console.error("✗ NEXT_PUBLIC_SUPABASE_URL must not end with /rest/v1/\n");

const db = new PostgrestClient(`${url.replace(/\/+$/, "").replace(/\/rest\/v1$/, "")}/rest/v1`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
});

const checks: [string, string, () => PromiseLike<{ error: { message: string } | null }>][] = [
  ["users table", "0001_init.sql", () => db.from("users").select("email").limit(1)],
  ["decks table", "0001_init.sql", () => db.from("decks").select("id").limit(1)],
  ["generations table (+ model column)", "0001_init.sql", () => db.from("generations").select("id, model").limit(1)],
  ["deck_costs view", "0001_init.sql", () => db.from("deck_costs").select("deck_id").limit(1)],
  ["monthly_cost view", "0001_init.sql", () => db.from("monthly_cost").select("month").limit(1)],
  ["deck_sections table", "0002_deck_sections.sql", () => db.from("deck_sections").select("deck_id").limit(1)],
  ["decks.source_md column", "0003_source_and_ist_months.sql", () => db.from("decks").select("source_md").limit(1)],
  ["modules table (saved module names)", "0005_modules.sql", () => db.from("modules").select("id").limit(1)],
  ["decks.budget_tier column", "0004_budget_tier.sql", () => db.from("decks").select("budget_tier").limit(1)],
  ["decks.reserved_usd column", "0006_concurrency.sql", () => db.from("decks").select("reserved_usd").limit(1)],
  ["deck_sections.draft_md column", "0006_concurrency.sql", () => db.from("deck_sections").select("draft_md").limit(1)],
  // A nonexistent deck id + a $0 amount: reserve_budget's UPDATE matches zero rows, so this calls
  // the function (proving it exists and is callable) without touching any real deck's data.
  [
    "reserve_budget() function",
    "0006_concurrency.sql",
    () => db.rpc("reserve_budget", { p_deck_id: "00000000-0000-0000-0000-000000000000", p_amount: 0, p_budget: 3 }),
  ],
  [
    "release_budget_reservation() function",
    "0006_concurrency.sql",
    () => db.rpc("release_budget_reservation", { p_deck_id: "00000000-0000-0000-0000-000000000000", p_amount: 0 }),
  ],
];

async function main() {
  let bad = 0;
  for (const [name, migration, run] of checks) {
    const { error } = await run();
    if (error) {
      bad++;
      console.log(`✗ ${name}\n    ${error.message}\n    -> run supabase/migrations/${migration}`);
    } else console.log(`✓ ${name}`);
  }
  const { count } = await db.from("users").select("*", { count: "exact", head: true });
  console.log(`\nusers signed in so far: ${count ?? "unknown"} (a row is created at sign-in; decks need it)`);
  console.log(bad ? `\n${bad} problem(s) found.` : "\nAll migrations are applied.");
  process.exit(bad ? 1 : 0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
