import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { splitCards, stripOuterFence } from "@/lib/cards";

const card = (title: string, type = "cue_card") =>
  `---\ntitle: ${title}\ndescription: d\nduration: 60\ncard_type: ${type}\n---\n\n# ${title}\n\nBody of ${title}\n`;

describe("splitCards", () => {
  it("splits on frontmatter and reads the fields", () => {
    const cards = splitCards(card("One") + "\n" + card("Two", "quiz_card"));
    expect(cards.map((c) => c.title)).toEqual(["One", "Two"]);
    expect(cards[1].cardType).toBe("quiz_card");
    expect(cards[0].duration).toBe(60);
    expect(cards[0].body).toContain("Body of One");
    expect(cards[0].body).not.toContain("card_type");
  });

  it("does not treat a horizontal rule in a body as a card boundary", () => {
    const text = card("One").replace("Body of One", "Before\n\n---\n\nAfter") + "\n" + card("Two");
    const cards = splitCards(text);
    expect(cards).toHaveLength(2);
    expect(cards[0].body).toContain("After");
  });

  it("keeps a deck heading with the first card", () => {
    const cards = splitCards("# Deck Title\n\n" + card("One") + card("Two"));
    expect(cards[0].raw.startsWith("# Deck Title")).toBe(true);
    expect(cards[1].raw.startsWith("---")).toBe(true);
  });

  it("handles streaming partials and empty input", () => {
    expect(splitCards("")).toEqual([]);
    expect(splitCards("---\ntitle: Half")).toHaveLength(1);
  });

  it("finds every card in the real golden examples", () => {
    for (const [file, cue, quiz] of [
      ["prose-cards", 16, 5],
      ["notebook-cards", 21, 5],
    ] as const) {
      const cards = splitCards(readFileSync(`lib/sop/examples/${file}.md`, "utf8"));
      expect(cards.filter((c) => c.cardType === "cue_card")).toHaveLength(cue);
      expect(cards.filter((c) => c.cardType === "quiz_card")).toHaveLength(quiz);
    }
  });
});

describe("stripOuterFence", () => {
  // No trailing newline: that's what's actually between the fence lines once unwrapped, since the
  // closing ``` is a line of its own right after it, not appended to the content's own text.
  const card = "---\ntitle: One\ncard_type: cue_card\n---\n\nBody text";
  const wrapped = (fenceOpen: string) => `${fenceOpen}\n${card}\n\`\`\``;

  it("strips a ```markdown wrapper around the whole reply", () => {
    expect(stripOuterFence(wrapped("```markdown"))).toBe(card);
  });

  it("strips a bare ``` wrapper (no language tag) and a ```md tag", () => {
    expect(stripOuterFence(wrapped("```"))).toBe(card);
    expect(stripOuterFence(wrapped("```md"))).toBe(card);
  });

  it("tolerates leading/trailing blank lines around the wrapper", () => {
    expect(stripOuterFence(`\n\n${wrapped("```markdown")}\n\n`)).toBe(card);
  });

  it("leaves normal output (starting with frontmatter, no wrapper) untouched", () => {
    expect(stripOuterFence(card)).toBe(card);
  });

  it("does not touch a real code fence that is part of a card's own content", () => {
    const withCode = "---\ntitle: Code\ncard_type: cue_card\n---\n\n```python\nprint(1)\n```\n";
    expect(stripOuterFence(withCode)).toBe(withCode);
  });

  it("does not strip when the fence only opens or only closes, not both", () => {
    const openOnly = "```markdown\n" + card;
    expect(stripOuterFence(openOnly)).toBe(openOnly);
  });

  it("never returns empty text even if the wrapper looks empty inside", () => {
    expect(stripOuterFence("```markdown\n```")).toBe("```markdown\n```");
  });

  it("strips per-section, so a multi-section document with one wrapped section is handled by applying it before each section is saved", () => {
    // Simulates two sections saved independently, one of which the model wrapped.
    const clean = stripOuterFence(card) + "\n\n" + stripOuterFence(wrapped("```markdown"));
    expect(clean).not.toContain("```markdown");
  });
});
