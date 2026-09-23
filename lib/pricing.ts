// ESTIMATES ONLY (pre-generation cost preview and budget pre-checks).
// Billing always uses the cost OpenRouter reports in `usage.cost`.
// Rates from https://openrouter.ai/api/v1/models, USD per token.

export type Rates = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  /** Tokens this model's tokenizer produces for the same text, relative to Sonnet 4.6. */
  tokenFactor: number;
};

// Cache-write rate assumes the 1-hour cache (`ttl: "1h"`, 2x input price), not the 5-minute default
// (1.25x) — see lib/openrouter.ts. PENDING LIVE VERIFICATION: run npm run verify:caching once
// OPENROUTER_API_KEY works again to confirm OpenRouter actually honours the ttl field; if it's
// silently ignored (falls back to 5-min), this estimate runs slightly high, not low — the safer
// direction for a pre-generation budget check to be wrong in.
const RATE_TABLE: Record<string, Rates> = {
  "anthropic/claude-sonnet-4.6": { input: 3e-6, output: 15e-6, cacheRead: 0.3e-6, cacheWrite: 6e-6, tokenFactor: 1 },
  // Cheaper per token, but its tokenizer is reported to emit ~30% more tokens for the same text.
  // Measure it with `npm run compare:models` and adjust.
  "anthropic/claude-sonnet-5": { input: 2e-6, output: 10e-6, cacheRead: 0.2e-6, cacheWrite: 4e-6, tokenFactor: 1.3 },
};

/** Rates for the configured model. An unknown slug gets the pricier rates so the guard errs on the safe side. */
export function ratesFor(model: string | undefined = process.env.LLM_MODEL): Rates {
  return RATE_TABLE[model ?? ""] ?? RATE_TABLE["anthropic/claude-sonnet-4.6"];
}

// Tunable guesses. Calibrate against real decks in the step 6 smoke test.
const CHARS_PER_TOKEN = 3.5; // conservative for markdown + code (Sonnet 4.6 tokenizer)
const OUTPUT_TO_SOURCE_RATIO = 0.6; // cue-card tokens produced per source token
// Billed as output; scaled by the model's tokenFactor. Pass 2 runs at reasoning effort "low" (see
// lib/openrouter.ts) since it's a bounded check-against-rules task, not open-ended drafting, so it
// reliably uses far fewer thinking tokens than Pass 1's "medium" — both are tunable guesses.
const THINKING_TOKENS_PER_CALL: Record<1 | 2, number> = { 1: 4_000, 2: 1_200 };

/** Tokens for a piece of text under the configured model's tokenizer. */
export const estimateTokens = (chars: number) => Math.ceil((chars / CHARS_PER_TOKEN) * ratesFor().tokenFactor);

export type Estimate = { inputTokens: number; outputTokens: number; costUsd: number };

/**
 * Estimated cost for a whole deck: `sectionChars` holds each section's length.
 * The SOP + example prefix is written to cache once, then read on every later call.
 */
export function estimateDeck(sectionChars: number[], prefixTokens: number): Estimate {
  const R = ratesFor();
  let cost = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let firstCall = true;

  for (const chars of sectionChars) {
    const src = estimateTokens(chars);
    const draft = Math.ceil(src * OUTPUT_TO_SOURCE_RATIO);
    for (const pass of [1, 2] as const) {
      const fresh = pass === 1 ? src : src + draft;
      const out = draft + Math.ceil(THINKING_TOKENS_PER_CALL[pass] * R.tokenFactor);
      cost += firstCall ? prefixTokens * R.cacheWrite : prefixTokens * R.cacheRead;
      cost += fresh * R.input + out * R.output;
      firstCall = false;
      inputTokens += prefixTokens + fresh;
      outputTokens += out;
    }
  }
  return { inputTokens, outputTokens, costUsd: cost };
}

/** Estimate for one upcoming call, used by the budget guard before each section/pass. */
export function estimateCall(pass: 1 | 2, sectionChars: number, prefixTokens: number, prefixCached: boolean): number {
  const R = ratesFor();
  const src = estimateTokens(sectionChars);
  const draft = Math.ceil(src * OUTPUT_TO_SOURCE_RATIO);
  const fresh = pass === 1 ? src : src + draft;
  const out = draft + Math.ceil(THINKING_TOKENS_PER_CALL[pass] * R.tokenFactor);
  const prefixRate = prefixCached ? R.cacheRead : R.cacheWrite;
  return prefixTokens * prefixRate + fresh * R.input + out * R.output;
}
