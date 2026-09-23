import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getDeck } from "@/lib/decks";
import { prewarmCache } from "@/lib/openrouter";
import { loadSopBlocks, SopMissingError } from "@/lib/sop/load";
import type { InputType } from "@/lib/parsers";

export const maxDuration = 30;

/**
 * Best-effort: warms the SOP+example cache before the real generate calls start, so the very
 * first real call reads a warm cache instead of paying to write one. Never fails the caller —
 * errors are swallowed inside prewarmCache itself; this route always returns 200 once auth and
 * ownership are confirmed, so the client never has to branch on whether it succeeded.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireUser();
  if (guard.error) return guard.error;
  const deck = await getDeck(params.id);
  if (!deck || (deck.created_by !== guard.user.email && !guard.user.isAdmin)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const sop = loadSopBlocks(deck.input_type as InputType);
    await prewarmCache(sop.blocks);
  } catch (err) {
    if (!(err instanceof SopMissingError)) console.warn("prewarm skipped", err);
  }
  return NextResponse.json({ ok: true });
}
