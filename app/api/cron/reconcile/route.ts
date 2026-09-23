import { NextResponse } from "next/server";
import { reconcile } from "@/lib/reconcile";

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
  return NextResponse.json(await reconcile({ limit: 500 }));
}
