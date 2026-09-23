export type Usage = {
  inputTokens: number;
  outputTokens: number;
  /** Prompt tokens served from cache. Zero on a cold call. */
  cachedTokens: number;
  /** Prompt tokens written to cache on this call (reported when the provider exposes it). */
  cacheWriteTokens: number;
  /** OpenRouter's reported cost in USD. Source of truth for billing. */
  costUsd: number;
};
