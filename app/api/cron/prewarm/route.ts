import { NextResponse } from "next/server";
import { prewarmCache } from "@/lib/openrouter";
import { loadSopBlocks, SopMissingError } from "@/lib/sop/load";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

/**
 * Keeps the SOP+example prompt cache warm across the whole day, not just for the duration of one
 * deck's run. Anthropic's prompt cache only ever offers a 1-hour TTL (there's no "cache for a day"
 * setting) — but each cache *read* also resets that 1-hour clock, so pinging both SOP variants
 * (notebook and prose — see lib/sop/load.ts) more often than the TTL keeps the cache permanently
 * warm without ever paying the expensive cold cache-write again. A hit here is a cheap cache-read,
 * not a full write, once the first ping of the day has warmed it.
 *
 * Same auth pattern as /api/cron/reconcile: Vercel Cron (or an external scheduler standing in for
 * it — see the note in vercel.json) sends `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, "warmed" | "skipped"> = {};
  for (const kind of ["ipynb", "md"] as const) {
    try {
      const sop = loadSopBlocks(kind);
      await prewarmCache(sop.blocks);
      results[kind] = "warmed";
    } catch (err) {
      if (err instanceof SopMissingError) results[kind] = "skipped";
      else throw err;
    }
  }
  return NextResponse.json({ ok: true, results });
}
