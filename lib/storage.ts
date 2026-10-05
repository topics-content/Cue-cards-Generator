import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { ParseError } from "@/lib/parsers/errors";

// Uploads go browser → Supabase Storage directly (signed URL), so they skip Vercel's 4.5 MB request
// body limit. Plain fetch against the Storage REST API, same reason lib/db.ts avoids supabase-js.
// The bucket is private and created by supabase/migrations/0010_uploads_bucket.sql.

export const BUCKET = "uploads";
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // free plan allows up to 50 MB per file
export const UPLOAD_EXTENSIONS = ["ipynb", "md", "markdown", "txt", "docx"];

function storageBase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars are not set");
  const base = url.replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
  return { base: `${base}/storage/v1`, headers: { apikey: key, Authorization: `Bearer ${key}` } };
}

/** Per-user folder, so a parse request can only consume the caller's own upload. */
export function ownerPrefix(email: string) {
  return createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 16);
}

/** Server-chosen object path: `<owner>/<uuid>.<ext>`. Throws ParseError for unsupported names. */
export function newUploadPath(email: string, fileName: string) {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  if (!fileName.includes(".") || !UPLOAD_EXTENSIONS.includes(ext)) {
    throw new ParseError("Unsupported file type. Upload .ipynb, .md or .docx.");
  }
  return `${ownerPrefix(email)}/${randomUUID()}.${ext}`;
}

/** True only for a path newUploadPath could have produced for this user. */
export function isOwnUploadPath(email: string, path: string) {
  const m = path.match(/^([0-9a-f]{16})\/[0-9a-f-]{36}\.([a-z]+)$/);
  return !!m && m[1] === ownerPrefix(email) && UPLOAD_EXTENSIONS.includes(m[2]);
}

/** Signed URL the browser PUTs the file to. Supabase signs uploads for 2 hours; not configurable. */
export async function createSignedUploadUrl(path: string): Promise<string> {
  const { base, headers } = storageBase();
  const res = await fetch(`${base}/object/upload/sign/${BUCKET}/${path}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: "{}",
  });
  if (!res.ok) throw new Error(`Storage sign failed (${res.status}): ${await res.text()}`);
  const { url } = (await res.json()) as { url: string };
  return `${base}${url}`;
}

export async function downloadUpload(path: string): Promise<Buffer> {
  const { base, headers } = storageBase();
  const res = await fetch(`${base}/object/authenticated/${BUCKET}/${path}`, { headers });
  if (res.status === 400 || res.status === 404) throw new ParseError("Upload not found. Try uploading the file again.");
  if (!res.ok) throw new Error(`Storage download failed (${res.status})`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > MAX_UPLOAD_BYTES) throw new ParseError("File is larger than 20 MB.");
  return bytes;
}

export async function deleteUploads(paths: string[]) {
  if (paths.length === 0) return;
  const { base, headers } = storageBase();
  const res = await fetch(`${base}/object/${BUCKET}`, {
    method: "DELETE",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: paths }),
  });
  if (!res.ok) throw new Error(`Storage delete failed (${res.status})`);
}

/**
 * Removes uploads older than `maxAgeMs`. Parse deletes its file in a `finally`, so this only
 * catches files whose parse request never arrived (tab closed mid-flow, function killed).
 */
export async function sweepStaleUploads(maxAgeMs = 60 * 60 * 1000) {
  const { base, headers } = storageBase();
  const list = async (prefix: string) => {
    const res = await fetch(`${base}/object/list/${BUCKET}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix, limit: 1000, offset: 0 }),
    });
    if (!res.ok) throw new Error(`Storage list failed (${res.status})`);
    return (await res.json()) as { name: string; id: string | null; created_at: string | null }[];
  };
  const cutoff = Date.now() - maxAgeMs;
  const stale: string[] = [];
  // Two levels: owner folders (id null), then files inside each.
  for (const folder of await list("")) {
    if (folder.id !== null) continue;
    for (const f of await list(folder.name)) {
      if (f.id && f.created_at && Date.parse(f.created_at) < cutoff) stale.push(`${folder.name}/${f.name}`);
    }
  }
  await deleteUploads(stale);
  return { deleted: stale.length };
}
