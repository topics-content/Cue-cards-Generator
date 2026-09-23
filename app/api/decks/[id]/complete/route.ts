import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getDeckForReview, saveEditedOutput, setReviewStatus } from "@/lib/decks";
import { validateMarkdown } from "@/lib/validateCards";

const ACTIONS = ["complete", "revert"] as const;
const MAX_MARKDOWN = 500_000;

/**
 * POST { action: "complete" | "revert", markdown?: string }
 * "complete" is only accepted when generation finished ("done") AND the markdown being completed
 * re-validates clean right now. That markdown is either `markdown` from the request body (the
 * validator dialog's current textarea, sent so an in-browser edit can be saved) or, if that's
 * absent or unchanged, the deck's last-saved output — never trusted blindly either way: the
 * server re-runs the same pure, rule-based check the dialog runs before accepting either one.
 * A `markdown` that validates clean and differs from what's already saved is persisted as the
 * deck's new edited_output_md (see lib/decks.ts::saveEditedOutput) in the same request, so fixing
 * errors in the dialog and completing is one action, not "reset your edit, then complete the old
 * version". No LLM call anywhere in this route.
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
  const currentSaved = deck.edited_output_md ?? deck.output_md;
  const markdownToCheck = candidate ?? currentSaved;

  const result = validateMarkdown(markdownToCheck);
  if (result.totalErrors > 0) {
    return NextResponse.json(
      { error: `${result.totalErrors} error${result.totalErrors === 1 ? "" : "s"} still found. Fix them, then validate again.`, result },
      { status: 422 },
    );
  }

  let savedMarkdown: string | undefined;
  if (candidate != null && candidate !== currentSaved) {
    await saveEditedOutput(deck.id, candidate);
    savedMarkdown = candidate;
  }
  await setReviewStatus(deck.id, "completed");
  return NextResponse.json({ reviewStatus: "completed", ...(savedMarkdown != null ? { savedMarkdown } : {}) });
}
