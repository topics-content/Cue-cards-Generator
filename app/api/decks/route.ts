import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createDeck, PROGRAMS } from "@/lib/decks";
import { llmModel } from "@/lib/openrouter";

const INPUT_TYPES = ["ipynb", "md", "docx", "gdoc"];

/** Creates a pending deck row; the client then generates section by section. */
export async function POST(req: Request) {
  const guard = await requireUser();
  if (guard.error) return guard.error;

  const b = await req.json().catch(() => null);
  const program = String(b?.program ?? "");
  const moduleName = String(b?.module ?? "").trim();
  const className = String(b?.className ?? "").trim();
  const inputType = String(b?.inputType ?? "");
  const source = typeof b?.source === "string" ? b.source : "";

  if (!(PROGRAMS as readonly string[]).includes(program))
    return NextResponse.json({ error: "Pick a Program." }, { status: 400 });
  if (!moduleName || !className)
    return NextResponse.json({ error: "Module and Class Name are required." }, { status: 400 });
  if (!INPUT_TYPES.includes(inputType) || !source.trim() || source.length > 600_000)
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });

  try {
    const created = await createDeck({
      createdBy: guard.user.email,
      program,
      module: moduleName,
      className,
      inputType,
      model: llmModel(),
      sourceChars: source.length,
      sourceMd: source,
    });
    return NextResponse.json({ id: created.id, module: created.module });
  } catch (err) {
    console.error("create deck failed", err);
    const e = err as { code?: string; message?: string };
    const msg = e.message ?? "";
    const error =
      e.code === "42703" || e.code === "PGRST204" || /column .* does not exist|schema cache/i.test(msg)
        ? "The database is missing a migration. Run the SQL files in supabase/migrations in order (npm run check:db shows which one)."
        : e.code === "23503"
          ? "Your user record is missing. Sign out and sign in again."
          : "Could not save the cue cards. Check the server log for details.";
    return NextResponse.json({ error }, { status: 500 });
  }

}
