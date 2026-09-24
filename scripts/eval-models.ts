// Runs the real two-pass pipeline (draft -> audit) on the same script section with several models and
// writes each model's cue cards plus a comparison report.
// Run: npm run eval:models -- [--input path.ipynb|.md|.docx] [--sections N] [model ...]
//   (needs OPENROUTER_API_KEY in .env.local)
// Default models: Sonnet 4.6 and Sonnet 5. Any OpenRouter slug works, including free ones ending in ":free".
// Output: eval-results/<timestamp>/report.md and one <model>.md file per model and section.
// Gemini direct (own key): prefix the model with "gemini:", e.g. gemini:gemini-2.5-pro, and set GEMINI_API_KEY
//   in .env.local. Optional GEMINI_PRICE_PER_M="<input $>,<output $>" per 1M tokens to fill the cost column.
// Add rows to an earlier report instead of starting a new one: --append eval-results/<timestamp>
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseUpload } from "../lib/parsers";
import { splitSections } from "../lib/chunk";
import { pass1Prompt, pass2Prompt, runningSummary } from "../lib/prompts";
import { chat, type SystemBlock } from "../lib/openrouter";
import type { Usage } from "../lib/usage";
import { stripOuterFence } from "../lib/cards";
import { validateMarkdown } from "../lib/validateCards";

const DEFAULT_MODELS = ["anthropic/claude-sonnet-4.6", "anthropic/claude-sonnet-5"];

function args() {
  const a = process.argv.slice(2);
  let input = "tests/fixtures/real-notebook.ipynb";
  let sections = 1;
  let append: string | undefined;
  const models: string[] = [];
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "--input") input = a[++i];
    else if (a[i] === "--sections") sections = Number(a[++i]);
    else if (a[i] === "--append") append = a[++i];
    else models.push(a[i]);
  }
  return { input, sections, append, models: models.length ? models : DEFAULT_MODELS };
}

// Same blocks as lib/sop/load.ts (which is server-only, so it can't be imported from a script).
function sopBlocks(kind: "notebook" | "prose"): SystemBlock[] {
  const read = (rel: string) => readFileSync(path.join("lib", "sop", rel), "utf8").replace(/<!--[\s\S]*?-->/g, "").trim();
  return [
    { text: `# SOP\n\n${read("guidelines.md")}`, cache: true },
    { text: `# Golden example\n\n## Source\n\n${read(`examples/${kind}-source.md`)}\n\n## Cue cards\n\n${read(`examples/${kind}-cards.md`)}`, cache: true },
  ];
}

type Call = { system: SystemBlock[]; user: string; reasoningEffort?: "low" | "medium" | "high" };

// Google's OpenAI-compatible endpoint, called with the user's own Gemini key (not via OpenRouter).
async function geminiChat(model: string, req: Call): Promise<{ text: string; usage: Usage }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set in .env.local");
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: 32_000,
      reasoning_effort: req.reasoningEffort ?? "medium",
      messages: [
        { role: "system", content: req.system.map((b) => b.text).join("\n\n") },
        { role: "user", content: req.user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 500)}`);
  const j = await res.json();
  const inputTokens = j.usage?.prompt_tokens ?? 0;
  const outputTokens = j.usage?.completion_tokens ?? 0;
  const [pin, pout] = (process.env.GEMINI_PRICE_PER_M ?? "0,0").split(",").map(Number);
  return {
    text: j.choices?.[0]?.message?.content ?? "",
    usage: { inputTokens, outputTokens, cachedTokens: 0, cacheWriteTokens: 0, costUsd: (inputTokens * pin + outputTokens * pout) / 1e6 },
  };
}

function caller(model: string): (req: Call) => Promise<{ text: string; usage: Usage }> {
  if (model.startsWith("gemini:")) return (req) => geminiChat(model.slice(7), req);
  return (req) => {
    process.env.LLM_MODEL = model; // lib/openrouter reads the model from here; models run one at a time
    return chat(req);
  };
}

type Row = { model: string; cards: number; errors: number; warnings: number; inTok: number; outTok: number; cost: number; secs: number; error?: string };

async function runModel(model: string, className: string, sections: string[], system: SystemBlock[], outDir: string): Promise<Row> {
  const call = caller(model);
  const row: Row = { model, cards: 0, errors: 0, warnings: 0, inTok: 0, outTok: 0, cost: 0, secs: 0 };
  const start = Date.now();
  const done: string[] = [];
  try {
    for (let i = 0; i < sections.length; i++) {
      const summary = runningSummary(done);
      const draft = await call({ system, user: pass1Prompt({ className, index: i, total: sections.length, section: sections[i], summary }) });
      const audit = await call({ system, user: pass2Prompt({ section: sections[i], draft: draft.text, summary }), reasoningEffort: "low" });
      for (const u of [draft.usage, audit.usage]) {
        row.inTok += u.inputTokens;
        row.outTok += u.outputTokens;
        row.cost += u.costUsd;
      }
      done.push(stripOuterFence(audit.text));
    }
    const md = done.join("\n\n");
    const v = validateMarkdown(md);
    Object.assign(row, { cards: v.cardCount, errors: v.totalErrors, warnings: v.totalWarnings });
    writeFileSync(path.join(outDir, `${model.replace(/[/:]/g, "_")}.md`), md);
  } catch (e) {
    row.error = String((e as Error).message ?? e).slice(0, 300);
  }
  row.secs = (Date.now() - start) / 1000;
  return row;
}

async function main() {
  const { input, sections: n, models, append } = args();
  const parsed = await parseUpload(path.basename(input), readFileSync(input));
  const sections = splitSections(parsed.text).slice(0, n);
  const system = sopBlocks(parsed.inputType === "ipynb" ? "notebook" : "prose");
  const className = path.basename(input).replace(/\.[^.]+$/, "");

  if (models.some((m) => !m.startsWith("gemini:")) && !process.env.OPENROUTER_API_KEY)
    throw new Error("OPENROUTER_API_KEY is not set in .env.local");
  const outDir = append ?? path.join("eval-results", new Date().toISOString().replace(/[:.]/g, "-"));
  mkdirSync(outDir, { recursive: true });
  if (!append) writeFileSync(path.join(outDir, "input.md"), sections.join("\n\n"));
  console.log(`Input: ${input} (${sections.length} section(s), ${sections.join("").length.toLocaleString()} chars)`);

  const rows: Row[] = [];
  for (const m of models) {
    console.log(`Running ${m} ...`);
    const r = await runModel(m, className, sections, system, outDir);
    console.log(r.error ? `  FAILED: ${r.error}` : `  ${r.cards} cards, ${r.errors} errors, ${r.warnings} warnings, $${r.cost.toFixed(4)}, ${r.secs.toFixed(0)}s`);
    rows.push(r);
  }

  const fmt = (r: Row) =>
    r.error
      ? `| ${r.model} | FAILED: ${r.error.replace(/\|/g, "/").replace(/\n/g, " ")} ||||||||`
      : `| ${r.model} | ${r.cards} | ${r.errors} | ${r.warnings} | ${r.inTok} | ${r.outTok} | ${r.cost.toFixed(4)} | ${r.secs.toFixed(0)} | [${r.model}](./${r.model.replace(/[/:]/g, "_")}.md) |`;
  const reportPath = path.join(outDir, "report.md");
  if (append && existsSync(reportPath)) {
    // Insert the new rows right after the last row of the existing table.
    const lines = readFileSync(reportPath, "utf8").split("\n");
    const last = lines.map((l) => l.startsWith("|")).lastIndexOf(true);
    lines.splice(last + 1, 0, ...rows.map(fmt));
    writeFileSync(reportPath, lines.join("\n"));
    console.log(`\nAppended to: ${reportPath}`);
    return;
  }
  const report = [
    `# Model eval: ${className}`,
    ``,
    `Date: ${new Date().toISOString()}  `,
    `Input: \`${input}\`, first ${sections.length} section(s)  `,
    `Pipeline: the app's own prompts (lib/prompts.ts, lib/sop/), pass 1 draft + pass 2 audit; errors/warnings from lib/validateCards.ts`,
    ``,
    `| Model | Cards | Validator errors | Warnings | Input tok | Output tok | Cost (USD) | Time (s) | Output |`,
    `|---|---|---|---|---|---|---|---|---|`,
    ...rows.map(fmt),
    ``,
    `Source text used: [input.md](./input.md)`,
  ].join("\n");
  writeFileSync(reportPath, report);
  console.log(`\nReport: ${reportPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
