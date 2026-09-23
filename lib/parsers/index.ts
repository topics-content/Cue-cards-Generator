import { convertDocxToMarkdown } from "./docx";
import { ParseError } from "./errors";
import { fetchGoogleDocDocx } from "./gdoc";
import { parseNotebook } from "./ipynb";

export { ParseError } from "./errors";

export type InputType = "ipynb" | "md" | "docx" | "gdoc";
export type ParsedScript = { text: string; inputType: InputType; imageCount: number };

export async function parseUpload(fileName: string, bytes: Buffer): Promise<ParsedScript> {
  const ext = fileName.toLowerCase().split(".").pop();
  if (ext === "ipynb") {
    const { text, imageCount } = parseNotebook(bytes.toString("utf8"));
    return { text, inputType: "ipynb", imageCount };
  }
  if (ext === "md" || ext === "markdown" || ext === "txt") {
    return { text: bytes.toString("utf8"), inputType: "md", imageCount: 0 };
  }
  if (ext === "docx") {
    const { text, imageCount } = await convertDocxToMarkdown(bytes);
    return { text, inputType: "docx", imageCount };
  }
  throw new ParseError("Unsupported file type. Upload .ipynb, .md or .docx.");
}

export async function parseGoogleDoc(url: string): Promise<ParsedScript> {
  const { text, imageCount } = await convertDocxToMarkdown(await fetchGoogleDocDocx(url));
  return { text, inputType: "gdoc", imageCount };
}
