// Measures the real per-request cost of Sonnet 4.6 vs Sonnet 5 on YOUR content.
// Run: npm run compare:models   (needs OPENROUTER_API_KEY in .env.local)
//
// Sends the same text to both models with a tiny max_tokens, so it costs a few cents. Reports how many
// prompt tokens each tokenizer produced and what OpenRouter charged. It measures input only; output and
// thinking length depend on the model's behaviour, so check those on real decks (Cost Observatory).
import { readFileSync } from "node:fs";
import { parseNotebook } from "../lib/parsers/ipynb";

const MODELS = ["anthropic/claude-sonnet-4.6", "anthropic/claude-sonnet-5"];
const key = process.env.OPENROUTER_API_KEY;
if (!key) {
  console.error("OPENROUTER_API_KEY is not set in .env.local");
  process.exit(1);
}

const sop = readFileSync(new URL("../lib/sop/guidelines.md", import.meta.url), "utf8");
const notebook = parseNotebook(readFileSync(new URL("../tests/fixtures/real-notebook.ipynb", import.meta.url), "utf8")).text;
const sample = notebook.slice(0, 16_000); // one typical section
const prose = readFileSync(new URL("../lib/sop/examples/prose-source.md", import.meta.url), "utf8").slice(0, 16_000);

async function measure(model: string, label: string, text: string) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Title": "Cue Card Generator" },
    body: JSON.stringify({
      model,
      max_tokens: 16,
      usage: { include: true },
      messages: [
        { role: "system", content: sop },
        { role: "user", content: `${text}\n\nReply with the single word: ok.` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 1200)}`);
  const u = (await res.json()).usage;
  return { model, label, tokens: u.prompt_tokens as number, cost: Number(u.cost) };
}

async function main() {
  for (const [label, text] of [["notebook section", sample], ["prose section", prose]] as const) {
    // One model failing (e.g. blocked by an OpenRouter guardrail) must not hide the other's numbers.
    const results = await Promise.allSettled(MODELS.map((m) => measure(m, label, text)));
    console.log(`\n${label} (${text.length.toLocaleString()} chars + SOP)`);
    results.forEach((r, i) => {
      if (r.status === "fulfilled") {
        console.log(`  ${r.value.model.padEnd(30)} prompt tokens ${String(r.value.tokens).padStart(7)}   cost $${r.value.cost.toFixed(5)}`);
      } else {
        const msg = String(r.reason?.message ?? r.reason);
        console.log(`  ${MODELS[i].padEnd(30)} UNAVAILABLE: ${msg}`);
        if (/guardrail/i.test(msg)) {
          console.log("    -> An OpenRouter guardrail (allowed models / data policy) blocks this model for your key.");
          console.log("       Open the link in the message above, or ask whoever manages the OpenRouter workspace to allow it.");
        }
      }
    });
    if (results.every((r) => r.status === "fulfilled")) {
      const [a, b] = results.map((r) => (r as PromiseFulfilledResult<Awaited<ReturnType<typeof measure>>>).value);
      console.log(`  Sonnet 5 counts ${(b.tokens / a.tokens).toFixed(2)}x the tokens; costs ${(b.cost / a.cost).toFixed(2)}x per request (input side)`);
      console.log(`  -> set tokenFactor for anthropic/claude-sonnet-5 in lib/pricing.ts to ~${(b.tokens / a.tokens).toFixed(2)}`);
    }
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
