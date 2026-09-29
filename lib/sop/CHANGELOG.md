# SOP change log

Why each change to guidelines.md and the golden examples was made. Not sent to the model.

Trimmed for the automated pipeline on 2026-09-22, at your request, to remove lines that either
duplicated another rule or actively fought the CRITICAL wording-fidelity rule in lib/prompts.ts
("carry over the script's wording; only restructure, never reword"). Removed or changed:
  - "Sample Script" section: three onboarding links the model can't open. Non-actionable, dropped.
  - "Objectives" section: described the SCRIPT a human writer produces from a recording
    ("conversational format", "grammatically sound") — this pipeline never writes a script, it
    only reformats one that already exists, so this was pushing the model to rewrite wording.
  - "Write Short Sentences ... retaining their original meaning": shortening a sentence and
    keeping it word-for-word are mutually exclusive. Direct conflict, removed.
  - "check with Grammarly before submitting for review": a step for a human writer, not the model.
  - Image bullets (diagrams, "use images for LaTeX", the Scaler Admin upload link): the model
    never has a real image to upload — notebook images arrive as `![plot-N](image-placeholder)`
    and nothing else. Left as instructions, the model could invent a fake image link. Replaced
    with a note to keep the placeholder as-is.
  - The colour-coding guide link: non-actionable; the actual colours are already listed below it.
  - "reference recording" wherever the model only ever sees a script: reworded to "script".
  - Title-character rule was stated twice; kept one copy, and folded in that a single hyphen used
    as a separator is fine (your own golden examples use it — "Opening Hook - 10 Million Rows").
  - "How to add tables in Markdown" (2026-09-22, at your request): the old rule ("HTML Format
    Table ... headers as Bold", no worked example) pushed the model toward a full inline-styled
    HTML `<table>` repeated per table — expensive in output tokens and inconsistent card to card.
    Replaced with a one-time `<style>` block at the top of the file plus plain GFM tables below it,
    so styling cost is paid once per file instead of once per table.
  - "How to add tables in Markdown" again (2026-09-23): that first version put the `<style>` block
    before the file's first card `---`, which broke real ingestion — a real generated deck showed
    the first card's title/description/duration rendering as plain visible text in HackMD instead
    of being read as metadata, because anything before the opening `---` stops it being recognized
    as a frontmatter delimiter at all. Moved the block to the first thing inside the first card's
    body instead (still applies to every table in the file; `<style>` isn't scoped by position).
  - "How to Write Actionables" (2026-09-23): a real deck dropped two bracketed instructor cues,
    [WAIT FOR ANSWERS] and [REVEAL ANSWER], entirely — not reworded, just gone, including the whole
    [REVEAL ANSWER] label even though the sentence after it survived. Neither matched a named colour
    category here, and pass2Prompt's audit checklist in lib/prompts.ts only ever asked the model to
    check for rewording and invention, never for content dropped with no trace — added a line saying
    an unrecognized bracketed cue is kept as plain text, not cut, and added that third check to the
    audit prompt itself.
  - "When to start a new cue card" (2026-09-24, new section): a real deck split a numbered
    "Section 3" / "3.1" / "3.2" source structure into a separate card per subheading, including a
    card that was little more than a heading with almost no content of its own. Nothing anywhere
    said cards should follow topic boundaries rather than heading boundaries — the golden examples
    already do this correctly (e.g. IN / NOT IN / BETWEEN share one card as H2 subsections) but it
    was never stated as a rule, only ever shown implicitly. Added the rule explicitly.
  - "When to start a new cue card" again (2026-09-24): the first version of that rule said a
    numbered subsection like 3.1 nests as H3 under a repeated "Section 3" H2. A real example showed
    the actually-wanted structure is flatter: skip repeating the title as a body heading at all, and
    let 3.1, 3.2, 3.3 be the card's own H2 siblings directly, since the frontmatter title already
    says "Section 3". Kept the H2-title+H3-aside pattern for the different case of a card with one
    distinct extra subsection rather than a numbered peer cluster (matches the existing "Section 1"
    / "Notation" card in notebook-cards.md, which this rule doesn't touch).
  - Hallucination-risk audit (2026-09-24):
    - "Use Pseudocode" bullet removed — written for a human deciding how to draft original content
      from scratch; this pipeline only reformats an existing script, so it never applies and only
      risked being read as permission to rewrite a source's own code into a different form.
    - "Example Content" (Good/Bad Example) rewritten — the old "Good Example" was a reworded version
      of the "Bad Example," not a restructured one (compare the opening sentences), and the "Note for
      Writers" praised it for "formal and precise language" — directly contradicting the CRITICAL
      fidelity rule in lib/prompts.ts, in text sent as literal system-prompt content on every call.
      Same category of leftover as the already-removed "Objectives" section: guidance for a human
      writing from scratch, not for restructuring an existing script. Now both examples use the exact
      same words; only structure differs.
    - DSML practice-question link: added "never invent or guess one" — the existing wording ("this
      link changes from one lecture to another") never said the replacement must come from the
      script, matching the same risk the image-placeholder rule already guards against elsewhere.
    - Program/module now passed into both prompts (lib/prompts.ts, threaded from lib/decks.ts's
      DeckRow) — the model previously had no way to know which module a deck belongs to, despite the
      SOP having module-specific template sections (DSML DA-track, DSML SQL), and had to guess
      applicability from the script's own content. The person creating the deck already picks
      program/module explicitly on the form; this just uses that instead of re-guessing it.
  - "Instructor-only headings" (2026-09-25): a real deck's source heading ("## Backpropagation")
    vanished with no trace after the model gave that card a more descriptive title, per the SOP's own
    "title should be descriptive... not generic" rule. FIDELITY_RULE and pass2Prompt's audit checklist
    in lib/prompts.ts only ever checked that prose statements/cues weren't dropped, never that a source
    heading's own words survive somewhere once a card gets a different title — added that check. Also,
    the "Instructor-only headings" section here said headings "should be plain, without any colour" —
    directly contradicting both golden examples, which colour the Agenda heading with a red background
    and "(for instructor only)". That convention was never stated in prose anywhere, only shown
    implicitly in the golden examples — added it explicitly, and fixed the same plain, uncoloured
    "## Agenda" worked example under "How to Add Tables in Markdown" to match.
  - FIDELITY_RULE (2026-09-25): added an explicit "never state the same content twice" line, and a
    matching audit check, alongside the heading-preservation fix above — the two changes were requested
    together so that instructing the model to restore missing content doesn't tip it toward restoring
    it in more than one place.
  - "How to Write Actionables" (2026-09-28): a real deck wrapped an entire "Note for Instructor"
    paragraph in the red-background span, so the whole note rendered red. Every red span in both golden
    examples holds only the label, but that was never stated — added it explicitly. No eval run, at
    your request.
  - "When a question becomes a quiz card" (2026-09-28, new section): a real deck turned a
    "**Question:**" with A–D options (answer given in the following Note for Instructor) into a violet
    line in a cue card instead of a quiz_card. Nothing said what makes a quiz — the golden examples only
    ever show sources that say "Quiz N" or "Correct Answer:", and notebook-source.md uses "**Question:**"
    for open questions. Added the rule, plus "no stated answer → no [x], never guess". No eval run.
  - Module-specific templates (2026-09-28, at your request): removed the "DSML – SQL module only"
    dialogue template entirely. Kept the DA-track "Unlock Assignment" card, but it is no longer tied to
    any program/module — it now applies only when the script itself contains an unlock-assignment part.
    Also added the missing opening ```` fence around that template (it only had a closing one).
    lib/prompts.ts no longer sends program/module to the model; its template guard is replaced by a
    check keyed on the script's content.
  - Code fidelity (2026-09-28): the prose golden cards had corrupted code the source doesn't have —
    `zomato. orders` (space) in 26 places, `| |` instead of `||`, and `Zomato.customer's` instead of
    `zomato.customers`. The model reads the golden as correct output, so it learned small code edits were
    fine. Fixed the golden to match the source; added a byte-for-byte rule for code, URLs, LaTeX and
    identifiers under "Code blocks", in FIDELITY_RULE, and as a pass-2 audit check.
  - Quiz fidelity (2026-09-28): the prose golden's Quiz 5 choices had trailing full stops ('%50.') the
    source doesn't have — wrong SQL shown as answer options, and it taught the model choices can be
    edited. Fixed the golden; tightened the quiz rule to "punctuation included"; added a pass-2 check.
  - Inline code and math (2026-09-28, your rules): single backticks for one-line code, keywords/special
    characters and any underscore word; LaTeX kept as written or a single symbol in backticks, never bare.
    Golden synced: prose-cards.md inline SQL/identifiers wrapped (66 spots); notebook-cards.md bare math
    restored to the source's LaTeX (8 lines) or wrapped (3). Also restored 28 punctuation/wording edits
    in prose-cards.md (commas, "Type this with me.", "it's", "precedent", "cannot use indexes") to source.
  - Images (2026-09-28, your rules): every script image becomes <img width="500"> with the source's URL, or
    the fixed placeholder URL (alt image-N) when there isn't one; no other URL is ever allowed except the
    Unlock template's two. Deleted "Uploading images" (human step). Golden sync: prose-cards.md had 20
    invented screenshot URLs — 18 became the placeholder, and prose-source.md now has the matching
    ![plot-N](image-placeholder) markers at its blank image slots (what the docx/gdoc parser emits); the
    other 2 were screenshots standing in for source tables the cards had dropped, so the tables are
    restored as GFM (plus the required <style> block in the first card). notebook-cards.md: the invented
    image replacing the source's ASCII diagram is now that diagram in a text= block; the slider screenshot
    became the placeholder, with a matching marker in notebook-source.md.
  - Tables (2026-09-28): the prose golden had turned all four source tables into screenshots or a
    bulleted list (the Agenda lost its times). Rebuilt all four as GFM from the source; added "a source
    table stays a GFM table"; pass-2 check added. The LIKE-patterns table had been mis-mapped to an image
    slot in the previous step — its source marker is removed and the placeholders renumbered (17 now).
  - Change log moved out of guidelines.md (2026-09-28): it was an HTML comment at the top of the SOP.
    lib/sop/load.ts already stripped comments before sending, so it never reached the model, but keeping
    it here makes that impossible to get wrong and keeps the SOP file readable.
  - 2026-09-28 batch: removed the invented Unlock card from prose-cards.md (source has no unlock part);
    removed 4 invented lines from notebook-cards.md ("Visualise how softmax redistributes confidence.",
    "Run this cell to reveal…", "Link to Animation…", "Explain using this link…"); added "never add a
    line the source doesn't contain"; replaced the invented Drive dataset link with the source's text and
    added "add a link only when the script gives the URL"; the table <style> block is no longer written by
    the model — lib/cards.ts addTableStyle() inserts it after all sections merge (lib/decks.ts
    finalizeDeck), and pass 2 is now told which section it is auditing.
  - "How to add images in Markdown" (2026-09-28): its "Good practice" example used a real CDN URL
    (043/265), contradicting "never write any other image URL" — the model could copy it. Replaced with
    the placeholder URL and alt="image-N".
  - Math (2026-09-28, reverses the earlier "backticks also fine"): LaTeX stays LaTeX; only math that is
    bare text in the source may be backticked. `e^{z_k}` in backticks renders as raw text in HackMD and
    `z1` loses the subscript. notebook-cards.md: 12 lines' backticked math restored to the source's $…$,
    5 display formulas restored to the source's exact spacing.
  - Unlock template (2026-09-28): the Emp 101 fallback practice link is gone — no link in the script now
    means a red [PRACTICE LINK NEEDED] label. The template's red Note now wraps only the label.
  - "Instructor cue" mapping (2026-09-28): the source uses both "Instructor Note -" and "Instructor cue";
    the SOP never said what "Instructor cue" becomes, and the prose golden produced "Instructor Note:
    Instructor cue don't deep-dive" once (its other four cues were already right). Added the mapping for
    both source labels; fixed that golden line.
  - Heading levels (2026-09-28): the Prefix Sum example and the Cue Card Format example used # (H1),
    contradicting "content starts at H2". Changed them to ##; added "# only as # Question / # Choices in
    quiz cards". The validator's no-heading hint said "# Heading" — now "## Heading".
  - Tables (2026-09-28): deleted "Keep cell text short; move long explanations below the table" — it
    moved source content around, conflicting with "keep every row and column" and the fidelity rule.
  - "Lines that are dropped" (2026-09-28, new section): the golden drops the lecture header, program line,
    hour banners, timing lines and doc-export leftovers (Tab 1/2, "here are the quiz questions"), but the
    heading-survival and no-dropping rules would have the audit restore them. Listed them as the only
    exception; timings go into duration. Mirrored in FIDELITY_RULE and the pass-2 heading check.
  - Cleanup (2026-09-28): deleted human-only text ("Welcome to Scaler's Content team", the "What's a cue
    card" section with its "So a alot" typo, "Don't use screenshots/images for code" — already covered by
    the image rule); added the missing opening ```` fence to the "Quiz cards: no extra text" example; put
    the loose "## SQL code / ## Python code / if language not known" lines inside one fenced example so
    they can't be copied as headings; Quiz-2 → Quiz 2; iframes use the source's width/height when given
    (the notebook golden's 1000 is from its source), 700 only as the default.
  - Label mapping table (2026-09-28): replaced the loose actionables bullets, the "Actionable examples",
    "Question, in violet" and "Dataset link" sections with one Source label → Output table (Instructor
    Note / Instructor cue / Note for Instructor; Question to the class / Ask Learners; Doubt by Learner;
    Important / Note / Disclaimer; open Question; Dataset), plus the label-only and never-both rules.
    Dropped "Miscellaneous" (invited arbitrary colours) and "try to bullet point…" (now: several statements
    → bullets, one → same line). Goldens normalized to the exact spans: 18 red labels' style strings, 2
    violet, 6 orange; prose "Note:" and "Question:" lines now use their mapped spans; a stray full stop the
    source doesn't have removed; notebook Agenda heading "( for instructor only) " → "(for instructor only)".
    Unlock template's Note uses the mapped span.
  - Quiz answers (2026-09-28): the explanation card now opens with **Correct Answer:** <option text>
    (letter and brackets dropped); answer-but-no-explanation → a card with just that line; neither → no
    card, all [ ]. Pass-2 check added. Goldens: Correct Answer line added to notebook Quiz 1–4 and all 5
    prose quizzes (code answers backticked); notebook Quiz 5's "**Correct Answer: B. …**" normalized.
