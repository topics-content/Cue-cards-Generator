import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { PROGRAMS } from "@/lib/decks";
import { listModules } from "@/lib/queries";

/** Module names already used under a Program, for the form's autocomplete. */
export async function GET(req: Request) {
  const guard = await requireUser();
  if (guard.error) return guard.error;
  const program = new URL(req.url).searchParams.get("program") ?? "";
  if (!(PROGRAMS as readonly string[]).includes(program)) return NextResponse.json({ modules: [] });
  return NextResponse.json({ modules: await listModules(program) });
}
