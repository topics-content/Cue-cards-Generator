import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getDeckForReview, setReviewStatus } from "@/lib/decks";
import { validateMarkdown } from "@/lib/validateCards";

const ACTIONS = ["complete", "revert"] as const;

/**
 * POST { action: "complete" | "revert" }
 * "complete" is only accepted when generation finished ("done") AND the deck's actual saved
 * output_md re-validates clean right now — never the client's copy, which may have been edited in
 * the browser without saving back. No LLM call here; validateMarkdown is the same pure, rule-based
 * check the in-app validator dialog runs, just re-run server-side as the authority.
 * "revert" always succeeds for the owner/admin — going back to draft needs no gate.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireUser();
  if (guard.error) return guard.error;
  const { user } = guard;

  const deck = await getDeckForReview(params.id);
  if (!deck || (deck.created_by !== user.email && !user.isAdmin)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const b = await req.json().catch(() => null);
  const action = b?.action;
  if (!ACTIONS.includes(action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (action === "revert") {
    await setReviewStatus(deck.id, "draft");
    return NextResponse.json({ reviewStatus: "draft" });
  }

  if (deck.status !== "done") {
    return NextResponse.json({ error: "Cue cards aren't finished generating yet." }, { status: 409 });
  }
  const result = validateMarkdown(deck.output_md);
  if (result.totalErrors > 0) {
    return NextResponse.json(
      { error: `${result.totalErrors} error${result.totalErrors === 1 ? "" : "s"} still found. Fix them, then validate again.`, result },
      { status: 422 },
    );
  }
  await setReviewStatus(deck.id, "completed");
  return NextResponse.json({ reviewStatus: "completed" });
}
