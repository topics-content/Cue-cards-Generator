import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { completedSectionIndexes, finalizeDeck, getDeck } from "@/lib/decks";

const STATUSES = ["done", "failed", "budget_exceeded"] as const;
type Final = (typeof STATUSES)[number];

/**
 * POST { status, totalSections }
 * Assembles decks.output_md from the finished sections. "done" is only accepted when every
 * section is present; a budget stop or failure keeps whatever completed.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireUser();
  if (guard.error) return guard.error;
  const { user } = guard;

  const deck = await getDeck(params.id);
  if (!deck || (deck.created_by !== user.email && !user.isAdmin)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const b = await req.json().catch(() => null);
  const status = b?.status as Final;
  const total = Number(b?.totalSections);
  if (!STATUSES.includes(status) || !Number.isInteger(total) || total < 1) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const done = await completedSectionIndexes(deck.id);
  if (status === "done" && done.length !== total) {
    return NextResponse.json(
      { error: `Only ${done.length} of ${total} sections are complete` },
      { status: 409 },
    );
  }
  const output = await finalizeDeck(deck.id, status);
  return NextResponse.json({ status, completedSections: done, output });
}
