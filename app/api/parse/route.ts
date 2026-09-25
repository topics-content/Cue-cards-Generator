import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { MAX_SECTION_CHARS, splitSections } from "@/lib/chunk";
import { wasRecentlyActive } from "@/lib/decks";
import { ParseError, parseGoogleDoc, parseUpload, type ParsedScript } from "@/lib/parsers";
import { prewarmCache } from "@/lib/openrouter";
import { estimateDeck, estimateTokens } from "@/lib/pricing";
import { budgetTiers } from "@/lib/budget";
import { loadSopBlocks, SopMissingError } from "@/lib/sop/load";

// loadSopBlocks only distinguishes these two families; match that here for the warmth check.
const NOTEBOOK_INPUT_TYPES = ["ipynb"];
const PROSE_INPUT_TYPES = ["md", "docx", "gdoc"];

export const maxDuration = 60;

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // Vercel's request body limit is 4.5 MB
const WARMUP_BUDGET_MS = 8_000; // cap on how long the estimate response waits for the warm-up below

/** Parses an upload (multipart `file`) or a Google Doc (`url`), then chunks it and estimates cost. */
export async function POST(req: Request) {
  const guard = await requireUser();
  if (guard.error) return guard.error;

  let parsed: ParsedScript;
  try {
    const form = await req.formData();
    const file = form.get("file");
    const url = form.get("url");
    if (file instanceof File) {
      if (file.size > MAX_UPLOAD_BYTES) throw new ParseError("File is larger than 4 MB.");
      parsed = await parseUpload(file.name, Buffer.from(await file.arrayBuffer()));
    } else if (typeof url === "string" && url.trim()) {
      parsed = await parseGoogleDoc(url);
    } else {
      throw new ParseError("Upload a file or paste a Google Doc URL.");
    }
  } catch (err) {
    if (err instanceof ParseError) return NextResponse.json({ error: err.message }, { status: 422 });
    console.error("parse failed", err);
    return NextResponse.json({ error: "Could not read that file." }, { status: 500 });
  }

  const text = parsed.text;
  if (!text.trim()) return NextResponse.json({ error: "The script is empty." }, { status: 422 });

  const sections = splitSections(text, MAX_SECTION_CHARS);
  let prefixTokens = 0;
  let sopMissing: string | null = null;
  try {
    const sop = loadSopBlocks(parsed.inputType);
    prefixTokens = sop.tokens;
    // Best-effort warm-up for the moment the user actually hits "Generate": while they're still
    // reviewing this estimate, get the SOP+example prompt cached with OpenRouter, so the real
    // generate call isn't the one paying for a cold cache write. wasRecentlyActive's own DB read
    // also nudges Supabase awake (it can pause when idle — see the comment on this in lib/auth.ts)
    // regardless of whether it finds recent activity, so there's no need for a second, separate
    // "just wake up the DB" query alongside it.
    //
    // Skipped entirely if a deck of this same input-type family was created recently: its own
    // generate calls almost certainly already warmed this exact cache entry, so prewarming again
    // would just be a redundant (if cheap) cache-read ping with no benefit.
    //
    // Awaited, not fire-and-forget: a serverless function can freeze the instant it returns its
    // response, which would silently cut this off before it ever reached OpenRouter. Capped at
    // WARMUP_BUDGET_MS since prewarmCache has no timeout of its own — without a cap, a slow or
    // unresponsive OpenRouter would hang the whole upload response, turning "warm the system" into
    // "make file upload feel broken." If the cap is hit we just stop waiting and return the
    // estimate anyway — the warm-up may not have finished, but that's the rare case, not the common
    // one, and it's still no worse than not warming up at all.
    const inputTypes = parsed.inputType === "ipynb" ? NOTEBOOK_INPUT_TYPES : PROSE_INPUT_TYPES;
    if (!(await wasRecentlyActive(inputTypes))) {
      await Promise.race([prewarmCache(sop.blocks), new Promise<void>((resolve) => setTimeout(resolve, WARMUP_BUDGET_MS))]);
    }
  } catch (err) {
    if (!(err instanceof SopMissingError)) throw err;
    sopMissing = err.message;
  }
  const estimate = estimateDeck(sections.map((s) => s.length), prefixTokens);
  const tiers = budgetTiers();
  const budget = tiers[0];

  return NextResponse.json({
    text,
    inputType: parsed.inputType,
    imageCount: parsed.imageCount,
    chars: text.length,
    estimatedTokens: estimateTokens(text.length),
    sections,
    estimate,
    budget,
    maxBudget: tiers[tiers.length - 1],
    tiers,
    overBudget: estimate.costUsd > budget,
    sopMissing,
  });
}
