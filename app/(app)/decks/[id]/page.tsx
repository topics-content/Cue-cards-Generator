import { notFound } from "next/navigation";
import { DeckRunner } from "@/components/DeckRunner";
import { durationMs } from "@/lib/admin-stats";
import { getUser } from "@/lib/auth";
import { splitSections } from "@/lib/chunk";
import { budgetTiers, capAt, nextCapAfter } from "@/lib/budget";
import { getDeckDetail } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function DeckPage({ params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) return null;
  const deck = await getDeckDetail(params.id);
  // Owner or admin only. Everyone else gets the same 404 as a missing id.
  if (!deck || (deck.createdBy !== user.email && !user.isAdmin)) notFound();

  const sections = splitSections(deck.source);
  const tiers = budgetTiers();
  const drafts = sections.map((_, i) => deck.sections.find((s) => s.index === i)?.draft ?? "");
  const outputs = sections.map((_, i) => deck.sections.find((s) => s.index === i)?.output ?? "");

  return (
    <DeckRunner
      deckId={deck.id}
      program={deck.program}
      module={deck.module}
      className={deck.className}
      source={deck.source}
      sections={sections}
      initialDrafts={drafts}
      initialOutputs={outputs}
      initialStats={deck.cost}
      initialReviewStatus={deck.reviewStatus}
      initialDurationMs={durationMs(deck)}
      inrRate={Number(process.env.INR_RATE ?? 95)}
      budget={tiers[0]}
      isOwner={deck.createdBy === user.email || user.isAdmin}
      initialStop={
        deck.status === "budget_exceeded"
          ? { spent: deck.cost.costUsd, estimate: 0, budget: capAt(tiers, deck.budgetTier), nextCap: nextCapAfter(tiers, deck.budgetTier), maxCap: tiers[tiers.length - 1], sectionIndex: 0, pass: 1 }
          : null
      }
    />
  );
}
