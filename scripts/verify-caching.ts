// Verifies prompt caching passes through OpenRouter to Sonnet.
// Run: npm run verify:caching   (needs OPENROUTER_API_KEY and LLM_MODEL in .env.local)
//
// Makes two calls with an identical cached prefix. The second must report cached_tokens > 0.
// Uses your real SOP + example files if filled in; otherwise pads with filler so the prefix
// clears Anthropic's minimum cacheable size (the mechanism is what's being tested, not the content).
import { readFileSync } from "node:fs";
import { chat, llmModel } from "../lib/openrouter";

const read = (p: string) => readFileSync(new URL(`../lib/sop/${p}`, import.meta.url), "utf8");
const isPlaceholder = (s: string) => s.replace(/<!--[\s\S]*?-->/g, "").trim().length < 50;

const sop = read("guidelines.md");
const example = `${read("examples/prose-source.md")}\n\n${read("examples/prose-cards.md")}`;

let system = [
  { text: `# SOP\n${sop}`, cache: true },
  { text: `# Golden example\n${example}`, cache: true },
];
const usingFiller = isPlaceholder(sop) || isPlaceholder(example);
if (usingFiller) {
  const filler = Array.from({ length: 400 }, (_, i) => `Rule ${i + 1}: keep each cue card focused on one idea and number it consistently.`).join("\n");
  system = [{ text: `# SOP (filler for caching test)\n${filler}`, cache: true }];
}

async function call(label: string, user: string) {
  const t0 = Date.now();
  const r = await chat({ system, user, maxTokens: 3000 });
  const { usage } = r;
  console.log(
    `${label}: input=${usage.inputTokens} cached=${usage.cachedTokens} cacheWrite=${usage.cacheWriteTokens} ` +
      `output=${usage.outputTokens} cost=$${usage.costUsd.toFixed(6)} id=${r.openrouterId} (${Date.now() - t0}ms)`,
  );
  return usage;
}

async function main() {
  process.env.LLM_REASONING_EFFORT ??= "low";
  console.log(`model=${llmModel()}${usingFiller ? "  [SOP files are placeholders: using filler prefix]" : ""}`);
  const a = await call("call 1 (cold)", "Reply with the single word: one.");
  // Give the cache entry a moment to become readable.
  await new Promise((r) => setTimeout(r, 2000));
  const b = await call("call 2 (warm)", "Reply with the single word: two.");

  if (b.cachedTokens > 0) {
    console.log(`\nPASS: caching works through OpenRouter (${b.cachedTokens} tokens read from cache).`);
  } else {
    console.error(
      "\nFAIL: second call reported cached_tokens = 0. Caching is NOT passing through; per-deck cost roughly doubles.",
    );
    process.exit(1);
  }
  void a;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
