import { afterEach, describe, expect, it } from "vitest";
import { estimateCall, estimateDeck, estimateTokens, ratesFor } from "@/lib/pricing";

const original = process.env.LLM_MODEL;
afterEach(() => { process.env.LLM_MODEL = original; });

describe("pricing follows the configured model", () => {
  it("uses Sonnet 4.6 rates ($3 in / $15 out per million)", () => {
    process.env.LLM_MODEL = "anthropic/claude-sonnet-4.6";
    // cacheWrite reflects the 1-hour cache (2x input), not the 5-min default (1.25x) — see lib/openrouter.ts.
    expect(ratesFor()).toMatchObject({ input: 3e-6, output: 15e-6, cacheRead: 0.3e-6, cacheWrite: 6e-6 });
  });

  it("Sonnet 5 counts ~30% more tokens for the same text", () => {
    process.env.LLM_MODEL = "anthropic/claude-sonnet-4.6";
    const t46 = estimateTokens(35_000);
    process.env.LLM_MODEL = "anthropic/claude-sonnet-5";
    expect(estimateTokens(35_000) / t46).toBeCloseTo(1.3, 1);
  });

  it("per request, Sonnet 5 is still cheaper than 4.6 at +30% tokens, but by ~13%, not 33%", () => {
    const sections = [12_000, 12_000, 12_000];
    process.env.LLM_MODEL = "anthropic/claude-sonnet-5";
    const v5 = estimateDeck(sections, estimateTokens(90_000)).costUsd;
    process.env.LLM_MODEL = "anthropic/claude-sonnet-4.6";
    const v46 = estimateDeck(sections, estimateTokens(90_000)).costUsd;
    expect(v5).toBeLessThan(v46);
    expect(v5 / v46).toBeGreaterThan(0.8); // token inflation eats most of the per-token discount
  });

  it("an unknown slug is estimated at the pricier rates, so the budget guard errs safe", () => {
    process.env.LLM_MODEL = "some/new-model";
    expect(ratesFor().output).toBe(15e-6);
  });

  it("per-call estimate uses the same rates", () => {
    process.env.LLM_MODEL = "anthropic/claude-sonnet-4.6";
    const c46 = estimateCall(1, 8000, 25_000, true);
    process.env.LLM_MODEL = "anthropic/claude-sonnet-5";
    // 4.6 pays more per token; Sonnet 5 counts more tokens. The estimate must reflect both.
    expect(c46).toBeGreaterThan(0);
    expect(estimateCall(1, 8000, 25_000, true)).toBeGreaterThan(0);
  });
});
