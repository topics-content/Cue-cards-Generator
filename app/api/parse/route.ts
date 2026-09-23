import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { MAX_SECTION_CHARS, splitSections } from "@/lib/chunk";
import { ParseError, parseGoogleDoc, parseUpload, type ParsedScript } from "@/lib/parsers";
import { estimateDeck, estimateTokens } from "@/lib/pricing";
import { budgetTiers } from "@/lib/budget";
import { loadSopBlocks, SopMissingError } from "@/lib/sop/load";

export const maxDuration = 60;

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // Vercel's request body limit is 4.5 MB

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
    prefixTokens = loadSopBlocks(parsed.inputType).tokens;
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
