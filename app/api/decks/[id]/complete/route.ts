import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getDeckForReview, saveEditedOutput, setReviewStatus } from "@/lib/decks";
import { validateMarkdown } from "@/lib/validateCards";

const ACTIONS = ["save", "revert"] as const;
const MAX_MARKDOWN = 500_000;

/**
 * POST { action: "save" | "revert", markdown?: string }
 * "save" is only accepted when generation finished ("done"). Unlike the old "complete" action,
 * it always persists `markdown` as the deck's edited_output_md (see lib/decks.ts::saveEditedOutput)
 * regardless of whether it validates clean — the full-screen editor needs to let someone save
 * progress on a card they haven't finished fixing yet, not force a discard-or-fix-now choice.
 * Marking the deck reviewed is the one thing still gated: the server re-runs the same pure,
 * rule-based check the editor runs (never trusting a client-reported "it's clean") on exactly the
 * markdown just saved, and only flips review_status to "completed" if that comes back with zero
 * errors. If it doesn't, an already-"completed" deck is dropped back to "draft" — a saved edit with
 * known errors is never left showing as verified. No LLM call anywhere in this route.
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

  const candidate = typeof b?.markdown === "string" && b.markdown.length <= MAX_MARKDOWN ? b.markdown : null;
  if (candidate == null) {
    return NextResponse.json({ error: "No markdown to save." }, { status: 400 });
  }
  const currentSaved = deck.edited_output_md ?? deck.output_md;

  const result = validateMarkdown(candidate);

  let savedMarkdown: string | undefined;
  if (candidate !== currentSaved) {
    await saveEditedOutput(deck.id, candidate);
    savedMarkdown = candidate;
  }

  const reviewStatus = result.totalErrors === 0 ? "completed" : "draft";
  if (reviewStatus !== deck.review_status) await setReviewStatus(deck.id, reviewStatus);

  return NextResponse.json({ reviewStatus, result, ...(savedMarkdown != null ? { savedMarkdown } : {}) });
}
