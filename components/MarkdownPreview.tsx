"use client";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";

type Node = { type: string; properties?: Record<string, unknown>; children?: Node[] };

// The cue-card colour spans use inline styles. Keep only colour declarations so generated
// content can't position, hide or overlay anything on the page.
const SAFE_DECL = /^(color|background-color)\s*:\s*[#a-zA-Z0-9(),.\s%]+$/;
function restrictStyles() {
  const walk = (n: Node) => {
    if (n.type === "element" && typeof n.properties?.style === "string") {
      const kept = n.properties.style.split(";").map((d) => d.trim()).filter((d) => SAFE_DECL.test(d));
      if (kept.length) n.properties.style = kept.join("; ");
      else delete n.properties.style;
    }
    n.children?.forEach(walk);
  };
  return (tree: Node) => walk(tree);
}

const schema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "span", "font"],
  attributes: {
    ...defaultSchema.attributes,
    span: ["style"],
    font: ["color"],
    img: ["src", "alt", "width", "height"],
  },
};

/** Rendered cue-card markdown: GFM, raw HTML allowed but sanitised (iframes are stripped). */
export function MarkdownPreview({ markdown }: { markdown: string }) {
  return (
    <div className="md-preview">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, restrictStyles, [rehypeSanitize, schema]]}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
