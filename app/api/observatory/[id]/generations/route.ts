import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { listGenerations } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** Per-section, per-pass cost breakdown for one set of cue cards. Costs and token counts only. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireUser();
  if (guard.error) return guard.error;
  return NextResponse.json({ generations: await listGenerations(params.id) });
}
