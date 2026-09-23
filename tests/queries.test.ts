import { beforeEach, describe, expect, it, vi } from "vitest";

// Regression test for a real bug: getDeckDetail used to destructure only `data` from the
// deck_sections/deck_costs queries, silently discarding `error`. When deck_sections failed (e.g.
// migration 0006 not yet applied, so `draft_md` doesn't exist), a finished deck with real content
// in decks.output_md rendered as if it had zero sections and had never been generated — the data
// was never actually lost, but the page made it look that way.
const state = {
  deck: { id: "11111111-1111-1111-1111-111111111111", created_by: "a@scaler.com", created_at: "t", program: "P", module: "M", class_name: "C", input_type: "md", status: "done", budget_tier: 0, source_md: "src", output_md: "the real finished output" },
  sectionsError: null as { message: string } | null,
  costsError: null as { message: string } | null,
};

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  db: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            if (table === "decks") return { data: state.deck, error: null };
            if (table === "deck_costs") return { data: null, error: state.costsError };
            throw new Error("unexpected table for maybeSingle: " + table);
          },
          order: async () => {
            if (table === "deck_sections") {
              return state.sectionsError
                ? { data: null, error: state.sectionsError }
                : { data: [{ section_index: 0, draft_md: null, output_md: "section 0 output" }], error: null };
            }
            throw new Error("unexpected table for order: " + table);
          },
        }),
      }),
    }),
  }),
}));

import { getDeckDetail } from "@/lib/queries";

beforeEach(() => {
  state.sectionsError = null;
  state.costsError = null;
});

describe("getDeckDetail: a failed sub-query must never look like an empty deck", () => {
  it("returns real section data when both queries succeed", async () => {
    const deck = await getDeckDetail("11111111-1111-1111-1111-111111111111");
    expect(deck?.output).toBe("the real finished output");
    expect(deck?.sections).toEqual([{ index: 0, draft: "", output: "section 0 output" }]);
  });

  it("throws — does not silently return empty sections — when the deck_sections query fails", async () => {
    state.sectionsError = { message: "column deck_sections.draft_md does not exist" };
    await expect(getDeckDetail("11111111-1111-1111-1111-111111111111")).rejects.toMatchObject({ message: expect.stringContaining("draft_md") });
  });

  it("throws when the deck_costs query fails, too", async () => {
    state.costsError = { message: "boom" };
    await expect(getDeckDetail("11111111-1111-1111-1111-111111111111")).rejects.toMatchObject({ message: "boom" });
  });
});
