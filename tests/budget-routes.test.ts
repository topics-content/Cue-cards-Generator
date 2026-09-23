import { beforeEach, describe, expect, it, vi } from "vitest";

// The real route handlers, with auth, storage and the LLM replaced by in-memory fakes.
// `reserved`/`spentReal` mirror what the real reserve_budget/release_budget_reservation Postgres
// functions track (migration 0006) — spentReal only grows via finishGeneration (a real, committed
// cost), reserved is a temporary hold released once a call finishes, success or not.
const state = {
  tier: 0, status: "pending", spentReal: 0, reserved: 0,
  owner: "a@scaler.com", user: "a@scaler.com", admin: false,
  drafts: {} as Record<number, string>, sections: {} as Record<number, string>,
};

vi.mock("@/lib/auth", () => ({
  requireUser: async () => ({ user: { email: state.user, name: null, isAdmin: state.admin } }),
}));
vi.mock("@/lib/decks", () => ({
  getDeck: async () => ({ id: "d1", created_by: state.owner, status: state.status, class_name: "C", input_type: "md", budget_tier: state.tier }),
  deckSpend: async () => state.spentReal,
  setDeckStatus: async (_id: string, s: string) => { state.status = s; },
  insertGeneration: async () => "row1",
  finishGeneration: async (_id: string, usage: { costUsd: number }) => { state.spentReal += usage.costUsd; },
  saveDraft: async (_id: string, i: number, text: string) => { state.drafts[i] = text; },
  saveSection: async (_id: string, i: number, text: string) => { state.sections[i] = text; },
  bumpBudgetTier: async (_id: string, from: number, max: number) => {
    if (from >= max) return from;
    state.tier = from + 1;
    state.status = "pending";
    return state.tier;
  },
  // No `await` between the check and the increment: mirrors the real function's atomicity, which
  // comes from a single Postgres statement under a row lock (see migration 0006), not from this
  // mock. This only proves the route correctly integrates with what reserveBudget returns.
  reserveBudget: async (_id: string, amount: number, budget: number) => {
    const ok = state.spentReal + state.reserved + amount <= budget;
    if (ok) state.reserved += amount;
    return { reserved: ok, spent: state.spentReal, reservedTotal: state.reserved };
  },
  releaseBudgetReservation: async (_id: string, amount: number) => {
    state.reserved = Math.max(0, state.reserved - amount);
  },
}));
vi.mock("@/lib/sop/load", () => ({
  SopMissingError: class extends Error {},
  loadSopBlocks: () => ({ blocks: [{ text: "sop", cache: true }], tokens: 25_000 }),
}));

let failNext = false;
vi.mock("@/lib/openrouter", () => ({
  llmModel: () => "anthropic/claude-sonnet-5",
  async *streamChat() {
    yield { type: "id", openrouterId: "gen-1" };
    await new Promise((r) => setTimeout(r, 0)); // yield a tick, so concurrent calls genuinely interleave here
    if (failNext) {
      failNext = false;
      throw new Error("simulated failure");
    }
    yield { type: "text", delta: "hi" };
    yield { type: "done", openrouterId: "gen-1", usage: { inputTokens: 1, outputTokens: 1, cachedTokens: 0, cacheWriteTokens: 0, costUsd: 0.01 } };
  },
}));

import { POST as generate } from "@/app/api/decks/[id]/generate/route";
import { POST as cont } from "@/app/api/decks/[id]/continue/route";

const ctx = { params: { id: "d1" } };
const gen = (pass: 1 | 2 = 1) =>
  generate(
    new Request("http://x", {
      method: "POST",
      body: JSON.stringify({ sectionIndex: 0, totalSections: 2, section: "x".repeat(8000), pass, draft: pass === 2 ? "draft text" : undefined }),
    }),
    ctx,
  );
const next = () => cont(new Request("http://x", { method: "POST" }), ctx);

beforeEach(() => {
  Object.assign(state, { tier: 0, status: "pending", spentReal: 0, reserved: 0, owner: "a@scaler.com", user: "a@scaler.com", admin: false, drafts: {}, sections: {} });
  failNext = false;
});

describe("tiered spend caps: $3 → $5", () => {
  it("runs normally while the next call fits under the cap", async () => {
    state.spentReal = 1;
    const res = await gen();
    expect(res.status).toBe(200);
    await res.text();
  });

  it("pauses at $3 before spending, and offers $5", async () => {
    state.spentReal = 2.99;
    const res = await gen();
    expect(res.status).toBe(402);
    expect(await res.json()).toMatchObject({ error: "budget_exceeded", budget: 3, nextCap: 5, maxCap: 5 });
    expect(state.status).toBe("budget_exceeded");
  });

  it("stays paused until the user clicks continue (no silent bypass)", async () => {
    state.spentReal = 3.5;
    expect((await gen()).status).toBe(402);
    expect((await gen()).status).toBe(402); // asking again changes nothing
  });

  it("continue raises the cap to $5 (the maximum) and generation resumes", async () => {
    state.spentReal = 3.5;
    await gen();
    const c = await next();
    expect(c.status).toBe(200);
    expect(await c.json()).toEqual({ cap: 5, nextCap: null });
    const res = await gen();
    expect(res.status).toBe(200);
    await res.text();
  });

  it("stops at $5 for good: 402 with no next cap, and continue is refused", async () => {
    Object.assign(state, { tier: 1, spentReal: 4.99 });
    const res = await gen();
    expect(res.status).toBe(402);
    expect(await res.json()).toMatchObject({ budget: 5, nextCap: null });
    const c = await next();
    expect(c.status).toBe(409);
    expect(state.tier).toBe(1);
  });

  it("an admin cannot bypass the cap by sending override", async () => {
    Object.assign(state, { tier: 1, spentReal: 4.99, user: "admin@scaler.com", admin: true });
    const res = await generate(
      new Request("http://x", { method: "POST", body: JSON.stringify({ sectionIndex: 0, totalSections: 2, section: "x".repeat(8000), pass: 1, override: true }) }),
      ctx,
    );
    expect(res.status).toBe(402);
  });

  it("only the creator or an admin can continue; others get a 404", async () => {
    Object.assign(state, { user: "other@scaler.com", admin: false });
    expect((await next()).status).toBe(404);
    expect(state.tier).toBe(0);
    Object.assign(state, { user: "admin@scaler.com", admin: true });
    expect((await next()).status).toBe(200);
  });
});

describe("draft vs. final persistence", () => {
  it("pass 1 saves a draft; pass 2 saves the audited section — different stores", async () => {
    await (await gen(1)).text();
    expect(state.drafts[0]).toBe("hi");
    expect(state.sections[0]).toBeUndefined();

    await (await gen(2)).text();
    expect(state.sections[0]).toBe("hi");
  });
});

describe("concurrency safety: the reservation, not a plain spend check, decides", () => {
  it("releases the reservation even when the call fails mid-stream", async () => {
    failNext = true;
    const res = await gen();
    expect(res.status).toBe(200); // the route always returns 200 and streams an error event
    const text = await res.text();
    expect(text).toContain('"t":"error"');
    expect(state.reserved).toBe(0); // released in the `finally`, not stuck
  });

  it("never lets concurrent calls collectively push spent + reserved over the cap", async () => {
    // Each call here (near the max section size) is estimated at ~$0.22 — 14+ of them exceed the
    // $3 cap. Firing 15 at once, with the deliberate tick in the streamChat mock so their
    // reservation checks genuinely interleave rather than trivially serializing in one microtask,
    // must still leave at least one refused and never let committed spend pass the cap.
    const big = () =>
      generate(
        new Request("http://x", { method: "POST", body: JSON.stringify({ sectionIndex: 0, totalSections: 2, section: "x".repeat(24_000), pass: 1 }) }),
        ctx,
      );
    const results = await Promise.all(Array.from({ length: 15 }, big));
    const statuses = results.map((r) => r.status);
    await Promise.all(results.map((r) => r.text()));

    expect(statuses).toContain(402);
    expect(statuses).toContain(200); // and not ALL refused — some genuinely fit before the cap was hit
    expect(state.spentReal).toBeLessThanOrEqual(3);
    expect(state.reserved).toBe(0); // every reservation was released by the time all calls settled
  });

  it("a single call's reservation is always released after it completes, leaving spend as the only real record", async () => {
    await (await gen()).text();
    expect(state.reserved).toBe(0);
    expect(state.spentReal).toBeCloseTo(0.01);
  });
});
