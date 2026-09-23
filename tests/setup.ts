// Dummy values so tests never depend on real secrets being present in the environment.
// Anything that needs a REAL key (verify-caching, compare-models, check-billing, check-db) is a
// separate script, not part of `npm test`.
process.env.OPENROUTER_API_KEY ??= "test-key";
process.env.LLM_MODEL ??= "anthropic/claude-sonnet-4.6";
