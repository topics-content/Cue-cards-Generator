import mammoth from "mammoth";

// mammoth's TypeScript definitions omit convertToMarkdown and the real shape of `images`.
type MammothImage = { altText?: string };
type MammothImages = { imgElement(convert: (image: MammothImage) => { src: string; alt?: string }): unknown };
type MammothMd = {
  convertToMarkdown(input: { buffer: Buffer }, options?: { convertImage?: unknown }): Promise<{ value: string }>;
  images: MammothImages;
};

export type DocxResult = { text: string; imageCount: number };

/**
 * mammoth's default image handling reads each embedded image and inlines it as a base64 data URI
 * (its `images.dataUri` converter) — the exact "base64 must never reach the API" problem the
 * notebook parser strips out, just for .docx instead, and previously unhandled here.
 *
 * Supplying our own `convertImage` means the image bytes are never even read (we never call
 * `image.readAsBase64String()`); each one becomes `![plot-N](image-placeholder)` instead, matching
 * the notebook convention so the same SOP rule and the same "N images replaced with placeholders"
 * UI copy apply to every input type, not just notebooks.
 */
export async function convertDocxToMarkdown(buffer: Buffer): Promise<DocxResult> {
  let imageCount = 0;
  const m = mammoth as unknown as MammothMd;
  const { value } = await m.convertToMarkdown(
    { buffer },
    { convertImage: m.images.imgElement(() => ({ src: "image-placeholder", alt: `plot-${++imageCount}` })) },
  );
  return { text: value, imageCount };
}
