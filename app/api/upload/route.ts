import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { ParseError } from "@/lib/parsers";
import { createSignedUploadUrl, MAX_UPLOAD_BYTES, newUploadPath } from "@/lib/storage";

/** Issues a signed URL so the browser can upload a script straight to Supabase Storage. */
export async function POST(req: Request) {
  const guard = await requireUser();
  if (guard.error) return guard.error;

  const b = await req.json().catch(() => null);
  const fileName = typeof b?.fileName === "string" ? b.fileName : "";
  const size = typeof b?.size === "number" ? b.size : NaN;
  try {
    // Early, friendly check; the bucket's own file_size_limit is what actually enforces it.
    if (!(size > 0)) throw new ParseError("The file is empty.");
    if (size > MAX_UPLOAD_BYTES) throw new ParseError("File is larger than 20 MB.");
    const path = newUploadPath(guard.user.email, fileName);
    return NextResponse.json({ path, uploadUrl: await createSignedUploadUrl(path) });
  } catch (err) {
    if (err instanceof ParseError) return NextResponse.json({ error: err.message }, { status: 422 });
    console.error("upload sign failed", err);
    return NextResponse.json({ error: "Could not start the upload." }, { status: 500 });
  }
}
