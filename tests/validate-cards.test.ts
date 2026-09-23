import { describe, expect, it } from "vitest";
import { validateMarkdown } from "@/lib/validateCards";

// Same fixtures as the standalone Cue Card Validator tool, used here to confirm the ported
// TypeScript logic still agrees with it rule-for-rule.

const CUE = `---
title: Introduction to Arrays
description: Optional description for introduction to arrays slide
duration: 300
card_type: cue_card
---

# Introduction to Arrays

Topics covered in this class
- How are arrays stored
- How to read a value from an array
- Time complexities for different operations`;

const QUIZ = `---
title: Quiz-2
description: Optional description
duration: 45
card_type: quiz_card
---

# Question

What are the **time and space complexities** to reverse an input array?

# Choices

- [x] Time: O(n), Space: O(n)
- [ ] Time: O(n), Space: O(1)
- [ ] Time: O(1), Space: O(n)
- [ ] Time: O(1), Space: O(1)`;

const TRAILING_CONTENT = `---
title: Few-shot vs Zero-shot
description: Optional description
duration: 120
card_type: cue_card
---

# Few-shot Prompting

> "Let's solidify the difference between these two approaches."

---
title: Quiz 2
description: Optional description
duration: 45
card_type: quiz_card
---

# Question

Your team has a specific format for ADRs. Which approach is most effective?

# Choices

- [ ] Zero-shot: describe the format in words
- [x] Few-shot: paste 2-3 examples then ask the model to produce one
- [ ] Just ask "Write an ADR" and reformat afterward
- [ ] Use a higher temperature setting

<span style="background-color: red;">**[Instructor says]**</span>

> "When you need output to match a specific template, showing beats telling."

## Chain-of-Thought Prompting and Output Formatting`;

const STRAY_AND_EMOJI = `---
title: Sorting Algorithms 🚀, a quick recap.
description: demo
duration: 200
card_type: cue_card
---

# Sorting Algorithms

Quick recap of what we covered

---

Some extra notes added with a horizontal rule above — this --- is not allowed.`;

describe("validateMarkdown", () => {
  it("passes a well-formed cue card with zero errors and warnings", () => {
    const r = validateMarkdown(CUE);
    expect(r.cardCount).toBe(1);
    expect(r.totalErrors).toBe(0);
    expect(r.totalWarnings).toBe(0);
  });

  it("passes a well-formed quiz card with zero errors", () => {
    const r = validateMarkdown(QUIZ);
    expect(r.cardCount).toBe(1);
    expect(r.totalErrors).toBe(0);
  });

  it("flags content stranded after a quiz card's choices", () => {
    const r = validateMarkdown(TRAILING_CONTENT);
    expect(r.cardCount).toBe(2);
    const messages = r.cards.flatMap((c) => c.errors.map((e) => e.msg));
    expect(messages).toContain("No cue card for content.");
  });

  it("flags an emoji in the title and a stray --- outside any card", () => {
    const r = validateMarkdown(STRAY_AND_EMOJI);
    expect(r.cardCount).toBe(1);
    const messages = r.cards.flatMap((c) => c.errors.map((e) => e.msg));
    expect(messages.some((m) => m.includes("contains emoji"))).toBe(true);
    expect(messages.some((m) => m.includes('Stray "---"'))).toBe(true);
  });

  it("flags a capital [X] and missing correct answer separately", () => {
    const capitalX = QUIZ.replace("[x] Time: O(n), Space: O(n)", "[X] Time: O(n), Space: O(n)");
    const r = validateMarkdown(capitalX);
    const messages = r.cards.flatMap((c) => c.errors.map((e) => e.msg));
    expect(messages.some((m) => m.includes("capital"))).toBe(true);
    expect(messages.some((m) => m.includes("No correct answer marked"))).toBe(true);
  });

  it("flags a bare underscore in the title but allows one inside backticks", () => {
    const bare = CUE.replace("title: Introduction to Arrays", "title: Reserved Keywords and __tablename__");
    const bareMessages = validateMarkdown(bare).cards.flatMap((c) => c.errors.map((e) => e.msg));
    expect(bareMessages.some((m) => m.includes("disallowed characters"))).toBe(true);

    const backticked = CUE.replace("title: Introduction to Arrays", "title: Reserved Keywords and `__tablename__`");
    const backtickedMessages = validateMarkdown(backticked).cards.flatMap((c) => c.errors.map((e) => e.msg));
    expect(backtickedMessages.some((m) => m.includes("disallowed characters"))).toBe(false);
  });

  it("allows == in a title outside backticks", () => {
    const r = validateMarkdown(CUE.replace("title: Introduction to Arrays", "title: Checking x == y in Arrays"));
    const messages = r.cards.flatMap((c) => c.errors.map((e) => e.msg));
    expect(messages.some((m) => m.includes("disallowed characters"))).toBe(false);
  });

  it("allows any character inside backticks except : and ---, which still error", () => {
    const anything = validateMarkdown(CUE.replace("title: Introduction to Arrays", "title: Reserved word `SELECT * FROM x WHERE y > 50%`"));
    const anythingMessages = anything.cards.flatMap((c) => c.errors.map((e) => e.msg));
    expect(anythingMessages.some((m) => m.includes("disallowed characters"))).toBe(false);

    const withColon = validateMarkdown(CUE.replace("title: Introduction to Arrays", "title: Reserved word `key: value`"));
    const colonMessages = withColon.cards.flatMap((c) => c.errors.map((e) => e.msg));
    expect(colonMessages.some((m) => m.includes('contains ":"'))).toBe(true);

    const withDashes = validateMarkdown(CUE.replace("title: Introduction to Arrays", "title: Reserved word `a --- b`"));
    const dashMessages = withDashes.cards.flatMap((c) => c.errors.map((e) => e.msg));
    expect(dashMessages.some((m) => m.includes('contains "---"'))).toBe(true);
  });

  it("does not flag an empty description value as an error", () => {
    const emptyDescription = CUE.replace("description: Optional description for introduction to arrays slide", "description:");
    const r = validateMarkdown(emptyDescription);
    const messages = r.cards.flatMap((c) => c.errors.map((e) => e.msg));
    expect(messages.some((m) => m.includes("description is empty"))).toBe(false);
  });

  it("flags a <style> block placed before the first card, with a message specific to why that breaks it", () => {
    const withStyle = `<style>\ntable { border-collapse: collapse; }\n</style>\n\n${CUE}`;
    const r = validateMarkdown(withStyle);
    expect(r.docErrors.some((e) => e.msg.includes("<style> block sits before the first card"))).toBe(true);
  });

  it("allows a <style> block placed as the first thing inside the first card's body", () => {
    const withStyle = CUE.replace(
      "# Introduction to Arrays",
      "<style>\ntable { border-collapse: collapse; }\n</style>\n\n# Introduction to Arrays",
    );
    const r = validateMarkdown(withStyle);
    expect(r.docErrors).toEqual([]);
    expect(r.totalErrors).toBe(0);
  });

  it("still flags real orphaned content before the first card, style block or not", () => {
    const r = validateMarkdown(`Some stray note\n\n${CUE}`);
    expect(r.docErrors.some((e) => e.msg === "No cue card for content.")).toBe(true);
  });

  it("reports no cards found for empty input", () => {
    const r = validateMarkdown("just some text, no frontmatter at all");
    expect(r.cardCount).toBe(0);
    expect(r.totalErrors).toBe(1);
    expect(r.docErrors[0].msg).toContain("No card metadata block detected.");
  });
});
