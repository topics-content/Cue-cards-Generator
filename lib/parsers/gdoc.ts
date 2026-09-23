import { ParseError } from "./errors";

const SHARING_HELP =
  "Set sharing to Anyone with the link → Viewer, or download as .docx and upload.";

export function extractDocId(url: string): string | null {
  return url.match(/docs\.google\.com\/document\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/)?.[1] ?? null;
}

/**
 * Fetches a Google Doc as .docx (not plain text): a plain-text export silently drops every
 * embedded image, and .docx is exactly what lib/parsers/docx.ts already knows how to convert
 * safely (image bytes replaced with a placeholder, never read). One code path handles images for
 * both uploaded .docx files and Google Docs.
 */
export async function fetchGoogleDocDocx(url: string): Promise<Buffer> {
  const id = extractDocId(url.trim());
  if (!id) throw new ParseError("That doesn't look like a Google Doc URL.");
  const res = await fetch(`https://docs.google.com/document/d/${id}/export?format=docx`, {
    redirect: "follow",
  });
  const isHtml = res.headers.get("content-type")?.includes("text/html");
  // Private docs either 403/404 or bounce to an HTML sign-in page that returns 200.
  if (res.status === 403 || res.status === 401 || res.status === 404 || isHtml) {
    throw new ParseError(SHARING_HELP);
  }
  if (!res.ok) throw new ParseError(`Google Docs returned an error (${res.status}).`);
  return Buffer.from(await res.arrayBuffer());
}
