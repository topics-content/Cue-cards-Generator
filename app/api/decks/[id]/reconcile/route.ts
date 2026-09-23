import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getDeck } from "@/lib/decks";
import { reconcile } from "@/lib/reconcile";

export const maxDuration = 60;

/** Settles this deck's costs from OpenRouter. The client calls it a little after a deck finishes. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireUser();
  if (guard.error) return guard.error;
  const deck = await getDeck(params.id);
  if (!deck || (deck.created_by !== guard.user.email && !guard.user.isAdmin)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(await reconcile({ deckId: deck.id }));
}
