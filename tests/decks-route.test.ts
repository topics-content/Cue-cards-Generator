import { beforeEach, describe, expect, it, vi } from "vitest";

const fail = { error: null as unknown };
vi.mock("@/lib/auth", () => ({ requireUser: async () => ({ user: { email: "a@scaler.com", name: null, isAdmin: false } }) }));
vi.mock("@/lib/openrouter", () => ({ llmModel: () => "anthropic/claude-sonnet-4.6" }));
vi.mock("@/lib/decks", () => ({
  PROGRAMS: ["Academy", "DSML", "AIML", "DevOps", "FDE"],
  createDeck: async () => {
    if (fail.error) throw fail.error;
    return { id: "deck-1", module: "Deep Learning" };
  },
}));

import { POST } from "@/app/api/decks/route";

const body = { program: "AIML", module: "Deep learning", className: "Backprop", inputType: "ipynb", source: "# hi" };
const post = () => POST(new Request("http://x", { method: "POST", body: JSON.stringify(body) }));
beforeEach(() => { fail.error = null; vi.spyOn(console, "error").mockImplementation(() => {}); });

describe("POST /api/decks", () => {
  it("creates the cue cards", async () => {
    expect(await (await post()).json()).toEqual({ id: "deck-1", module: "Deep Learning" });
  });
  it("explains a missing migration instead of a generic failure", async () => {
    fail.error = { code: "42703", message: "column decks.source_md does not exist" };
    const res = await post();
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/missing a migration/);
  });
  it("explains a missing user row", async () => {
    fail.error = { code: "23503", message: "violates foreign key constraint" };
    expect((await (await post()).json()).error).toMatch(/sign out and sign in/i);
  });
  it("always returns JSON, never an empty 500", async () => {
    fail.error = new Error("boom");
    const res = await post();
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBeTruthy();
  });
});
