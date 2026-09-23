import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { budgetTiers, capAt, nextCapAfter } from "@/lib/budget";
import { bumpBudgetTier, getDeck } from "@/lib/decks";

/**
 * The user's explicit "continue" after a budget pause: raises the cap one tier ($3 → $5 → $7).
 * Refuses once the maximum is reached. The client then calls /generate again.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireUser();
  if (guard.error) return guard.error;
  const deck = await getDeck(params.id);
  if (!deck || (deck.created_by !== guard.user.email && !guard.user.isAdmin)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const tiers = budgetTiers();
  const maxTier = tiers.length - 1;
  if (deck.budget_tier >= maxTier) {
    return NextResponse.json(
      { error: `The maximum of $${capAt(tiers, maxTier)} has been reached. Split the script to continue.`, cap: capAt(tiers, maxTier), nextCap: null },
      { status: 409 },
    );
  }
  const tier = await bumpBudgetTier(deck.id, deck.budget_tier, maxTier);
  return NextResponse.json({ cap: capAt(tiers, tier), nextCap: nextCapAfter(tiers, tier) });
}
