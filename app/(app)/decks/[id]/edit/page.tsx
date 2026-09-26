import { notFound, redirect } from "next/navigation";
import { DeckEditor } from "@/components/DeckEditor";
import { getUser } from "@/lib/auth";
import { getDeckDetail } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function DeckEditPage({ params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) return null;
  const deck = await getDeckDetail(params.id);
  // Owner or admin only. Everyone else gets the same 404 as a missing id.
  if (!deck || (deck.createdBy !== user.email && !user.isAdmin)) notFound();
  // Editing needs a finished deck to edit — send anyone who lands here early back to watch it run.
  if (deck.status !== "done") redirect(`/decks/${deck.id}`);

  return (
    <DeckEditor
      deckId={deck.id}
      program={deck.program}
      module={deck.module}
      className={deck.className}
      source={deck.source}
      markdown={deck.editedOutput ?? deck.output}
      initialReviewStatus={deck.reviewStatus}
    />
  );
}
