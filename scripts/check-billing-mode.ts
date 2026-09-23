// Makes one trivial call to see how your OpenRouter key is billed: normal credits, or BYOK
// (your own provider key attached to OpenRouter). Costs a fraction of a cent.
// Run: npm run check:billing
import { llmModel } from "../lib/openrouter";

async function main() {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: llmModel(),
      max_tokens: 5,
      usage: { include: true },
      messages: [{ role: "user", content: "Reply with one word: ok" }],
    }),
  });
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 300)}`);
  const { usage } = await res.json();

  console.log(`model: ${llmModel()}`);
  console.log(`is_byok: ${usage.is_byok ?? false}`);
  console.log(`usage.cost (OpenRouter's own fee): $${Number(usage.cost ?? 0).toFixed(6)}`);
  console.log(`upstream_inference_cost (the provider's own charge): $${Number(usage.cost_details?.upstream_inference_cost ?? 0).toFixed(6)}`);

  if (usage.is_byok) {
    console.log(
      "\nBYOK mode: requests route through your own provider key. OpenRouter charges its own fee " +
        "separately (0% up to a monthly allowance, per https://openrouter.ai/docs/features/byok), so " +
        "`usage.cost` alone understates what you actually pay. The app already adds both — see the " +
        "BYOK note in lib/openrouter.ts.",
    );
  } else {
    console.log("\nNormal mode: usage.cost is already the full amount you're billed.");
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
