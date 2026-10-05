import { NextResponse } from "next/server";
import { reconcile } from "@/lib/reconcile";
import { sweepStaleUploads } from "@/lib/storage";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Daily sweep for anything the per-deck reconcile missed (dropped connections, late settlements).
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Bypasses the session middleware on purpose.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Rides on this cron because Hobby allows one run per day; a sweep failure must not block reconcile.
  const uploads = await sweepStaleUploads().catch((e) => ({ error: String(e) }));
  return NextResponse.json({ ...(await reconcile({ limit: 500 })), uploads });
}
