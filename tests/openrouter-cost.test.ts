import { describe, expect, it } from "vitest";
import { parseUsage, fetchGeneration } from "@/lib/openrouter";

describe("parseUsage: BYOK-aware cost", () => {
  it("normal (non-BYOK): cost is the full billed amount as-is", () => {
    const u = parseUsage({ prompt_tokens: 100, completion_tokens: 50, cost: 0.002, is_byok: false });
    expect(u.costUsd).toBe(0.002);
  });

  it("BYOK with the free allowance still available: OpenRouter's fee is 0, real cost is upstream_inference_cost", () => {
    const u = parseUsage({
      prompt_tokens: 13, completion_tokens: 4, cost: 0, is_byok: true,
      cost_details: { upstream_inference_cost: 0.000099 },
    });
    expect(u.costUsd).toBeCloseTo(0.000099);
  });

  it("BYOK once the free allowance is used up: fee + upstream cost are both real money and both counted", () => {
    const u = parseUsage({ prompt_tokens: 1000, completion_tokens: 500, cost: 0.0001, is_byok: true, cost_details: { upstream_inference_cost: 0.002 } });
    expect(u.costUsd).toBeCloseTo(0.0021);
  });

  it("missing fields default to 0, never NaN or undefined", () => {
    expect(parseUsage(undefined).costUsd).toBe(0);
    expect(parseUsage({}).costUsd).toBe(0);
  });
});

describe("fetchGeneration: same BYOK handling for the settled record", () => {
  const okJson = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ data }) }) as Response;

  it("adds upstream_inference_cost only when is_byok is true", async () => {
    const realFetch = global.fetch;
    global.fetch = (async () =>
      okJson({ native_tokens_prompt: 100, native_tokens_completion: 50, native_tokens_cached: 0, is_byok: true, total_cost: 0, upstream_inference_cost: 0.0005 })) as typeof fetch;
    try {
      const u = await fetchGeneration("gen-1");
      expect(u?.costUsd).toBeCloseTo(0.0005);
    } finally {
      global.fetch = realFetch;
    }
  });

  it("does not add upstream_inference_cost for a normal (non-BYOK) request", async () => {
    const realFetch = global.fetch;
    global.fetch = (async () =>
      okJson({ native_tokens_prompt: 100, native_tokens_completion: 50, native_tokens_cached: 0, is_byok: false, total_cost: 0.003, upstream_inference_cost: 0.0028 })) as typeof fetch;
    try {
      const u = await fetchGeneration("gen-2");
      expect(u?.costUsd).toBeCloseTo(0.003);
    } finally {
      global.fetch = realFetch;
    }
  });
});
