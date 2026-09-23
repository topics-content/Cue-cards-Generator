import "server-only";
// Query-only client. supabase-js also boots a realtime WebSocket client, which throws on Node 20
// (no built-in WebSocket) and we never use realtime, so we talk to PostgREST directly.
import { PostgrestClient } from "@supabase/postgrest-js";
import { isAdminEmail } from "@/lib/admin";

let client: PostgrestClient | null = null;

/** Service-role client. Server only: the key must never reach the browser. */
export function db(): PostgrestClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Supabase env vars are not set");
    // Tolerate a URL pasted with the Data API path on the end.
    const base = url.replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
    client = new PostgrestClient(`${base}/rest/v1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  }
  return client;
}

export async function upsertUser(email: string, name: string | null) {
  const now = new Date().toISOString();
  const { error } = await db()
    .from("users")
    .upsert({ email, name, is_admin: isAdminEmail(email), last_seen: now }, { onConflict: "email" });
  if (error) throw error;
}
