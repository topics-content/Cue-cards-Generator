// Spend caps for one set of cue cards. Generation pauses at each cap; the user can choose to
// continue to the next one. The last tier is an absolute maximum: nothing goes past it.

/** DECK_BUDGET_USD is the first cap; DECK_BUDGET_STEPS_USD lists the further caps (default "5", making $5 the maximum). */
export function parseTiers(first: number, steps: string | undefined): number[] {
  const extra = (steps ?? "5")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  const tiers = [first, ...extra];
  // Must be strictly increasing, otherwise fall back to the single first cap.
  return tiers.every((t, i) => i === 0 || t > tiers[i - 1]) ? tiers : [first];
}

export function budgetTiers(): number[] {
  return parseTiers(Number(process.env.DECK_BUDGET_USD ?? 3), process.env.DECK_BUDGET_STEPS_USD);
}

/** The cap in force at a given tier (clamped to the maximum). */
export const capAt = (tiers: number[], tier: number) => tiers[Math.max(0, Math.min(tier, tiers.length - 1))];

/** The next cap the user could continue to, or null when already at the maximum. */
export const nextCapAfter = (tiers: number[], tier: number): number | null => tiers[tier + 1] ?? null;
