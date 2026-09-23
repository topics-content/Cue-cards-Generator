import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { budgetTiers } from "@/lib/budget";
import { deckStats, listUsers } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * Cost data for every cue card, visible to any signed-in Scaler user (401 when signed out).
 * Only costs and metadata: cue card content stays owner/admin only (see /decks/[id]).
 */
export async function GET() {
  const guard = await requireUser();
  if (guard.error) return guard.error;
  return NextResponse.json({
    decks: await deckStats(),
    users: await listUsers(),
    viewer: { email: guard.user.email, isAdmin: guard.user.isAdmin },
    budget: budgetTiers()[0],
    inrRate: Number(process.env.INR_RATE ?? 95),
  });
}
