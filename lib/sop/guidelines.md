<!--
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
Delete this comment whenever you're happy with the result; it's here so the change is auditable.
-->

Lecture Script Technical Content Writing Guidelines
aka Cue Card Creation Guidelines.

Welcome to Scaler's Content team. As a member of this team, your key responsibility will be to standardize the class content.

## What's a cue card

A cue card is a small card or note that contains key points or prompts to help someone remember what to say during a speech, presentation, or performance.

Cue cards should use consistent examples, analogies, and flow of topics, so instructors deliver a similar learning experience regardless of who is teaching the class.

So a alot of such cards are combined and then a lectures complete cue card is created

## Writing Guidelines

### Content

- Don't use screenshots/images for code.
- Use Punctuation Correctly: Correct punctuation usage ensures that the content flows well and is easy to read.
- Structuring: Ensure the content is well-structured with proper headings and subheadings.
- Use `>` as a block wherever adding a Scenario or Action for Instructor.
- When adding "Note for instructor" or "Ask Learners" as a prompt, try to bullet point the statements under it.

### Formatting

- Don't Skip Any Part of the Session: 100% coverage of the source script is important unless mentioned by the module owner. This includes hints/doubts/stories/comparisons and observations that are crucial for the understanding of the topic.
- Highlight Important Points/Words: Use bold or italic formatting to emphasize important points or words.
- Bullets Over Paragraphs: Where possible, use bullet points instead of long paragraphs to make the content more digestible.
- Images: a script image becomes `![plot-N](image-placeholder)`. Keep that placeholder exactly as given — there is no real image to link to, so never invent an image URL or an `<img>` tag.

## Example Content

Both examples below say exactly the same thing, in exactly the same words — that's deliberate. The only difference between them is structure.

### Bad Example — one wall of text

So, we have a thing called Prefix Sum, in the field of data structures and algorithms, it is a method that modifies an array so that the element at each index 'i' in the new array is the sum of the elements from '0' to 'i' in the old array.
The Prefix Sum concept is really important because it can solve many problems more efficiently, especially the ones that need to get cumulative sums. It can help us make algorithms run faster, which is always good.
There are things you should remember about Prefix Sum: firstly, it is also called a cumulative array; secondly, it's a quick way to get cumulative sums of arrays which is useful for a lot of problems.
Calculating Prefix Sum goes like this: firstly, we take the first element of the old array and put it as the first element of the new array; secondly, we take the current element in the old array and add it to the last element in the new array, then put this sum in the new array; thirdly, we do the second step again and again for all the elements.
Understanding the prefix sum will help you design better algorithms, so try using it in different problems to get good at it.

### Good Example — same words, restructured

````markdown
# Introduction

So, we have a thing called Prefix Sum, in the field of data structures and algorithms, it is a method that modifies an array so that the element at each index 'i' in the new array is the sum of the elements from '0' to 'i' in the old array.

# Importance of Prefix Sum

The Prefix Sum concept is really important because it can solve many problems more efficiently, especially the ones that need to get cumulative sums. It can help us make algorithms run faster, which is always good.

# Key Points

There are things you should remember about Prefix Sum:
- firstly, it is also called a cumulative array
- secondly, it's a quick way to get cumulative sums of arrays which is useful for a lot of problems

# Steps to Calculate Prefix Sum

Calculating Prefix Sum goes like this:
- firstly, we take the first element of the old array and put it as the first element of the new array
- secondly, we take the current element in the old array and add it to the last element in the new array, then put this sum in the new array
- thirdly, we do the second step again and again for all the elements

Understanding the prefix sum will help you design better algorithms, so try using it in different problems to get good at it.
````

Note for Writers:

Notice that not one word changed between the two — no "cleaning up" the casual phrasing, no shortening, no making it sound more formal. The only things that changed are structural: headings were added, and the "firstly / secondly / thirdly" runs were split into bullets at their own existing boundaries. That's the only kind of change this pipeline ever makes to a script's own wording — restructuring, never rewording, no matter how repetitive or casual the source sounds.

## Code blocks

For a code block, we need to follow this format:

````markdown
```language_name=

```
````

Example:

````markdown
```sql=

```
````

## How to Add Animations

```html
<iframe src="Link of Hosted Animations" width="100%" height="700" style="border:1px solid #ccc; border-radius:8px;"></iframe>
```

Adjust the height and width of the frame as per the view and needs of the animations.

## How to Write Actionables

- Note for Instructor / Ask Learners / Any Mandatory Note or Important Note [Color: Red]: `<span style="background-color: red;">`
- Doubts by learners, Optional Content (if instructed by Reviewer) [Color: Orange]: `<span style="color: orange;">`
- Question/Problem Statements (if small, highlight the complete statement), generally for Problem-Solving sessions [Color: Violet]: `<span style="color: violet;">`
- Miscellaneous: `<span style="background-color: red">` or `<font color='green'>`
- A bracketed instructor cue that doesn't match any category above (e.g. `[WAIT FOR ANSWERS]`, `[REVEAL ANSWER]`) is never a reason to drop it — keep it as plain bracketed text exactly as written. Not knowing which colour it deserves is not the same as it being safe to cut.

### Heading levels

No lecture-title heading — cue cards start directly with the first card's metadata. The card's `title:` metadata already names it; the body doesn't need to repeat that name as its own heading unless the card has exactly one extra aside worth calling out (see the second example below). Use H2 for whatever heading actually starts the card's real content; use H3, and H4 if it's needed, for genuine subsections nested under that.

```
## The Complete Architecture Flow
```

### When to start a new cue card

A new `---` card is for a genuinely new topic or teaching beat — not for every heading the source has. Only give a subsection its own card when it's substantial enough to stand on its own — its own multi-minute chunk of teaching, its own code walkthrough, its own quiz — not just because it has a heading. A card that ends up holding little more than a heading and one or two lines is a sign two cards should have been one.

**A numbered cluster (`3`, then `3.1`, `3.2`, `3.3`, ...) is one card, and the sub-points are that card's own H2 headings — not nested under a repeated "Section 3" heading.** The card's title metadata already says "Section 3"; don't also write it into the body as a heading. Go straight from the frontmatter into `3.1`, `3.2`, `3.3` as siblings at H2. This applies the same way whether the source is a script or a notebook.

```markdown
---
title: Section 3 - Selectors, Computing Derived Data
description: Reusable selectors for deriving cart totals from state
duration: 1200
card_type: cue_card
---

## 3.1 The Pattern We Keep Repeating

...

## 3.2 Adding Selectors to the Cart Slice

...
```

This is different from a card that has one distinct extra aside rather than a numbered cluster of peer sub-points — there, repeating the card's own title as an H2 and nesting the one aside under it at H3 is fine (for example, a card titled "Section 1: From One Decision to Many" whose body opens with `## Section 1: From One Decision to Many` and later has a single `### Notation` aside). The rule above is specifically for numbered, peer-level sub-points — don't wrap those in an extra heading that just repeats the title.

### Instructor-only headings

A heading marking content that shouldn't be shown to learners — the Agenda card's heading is the standing example — gets a red background and says so in words, the same way both golden examples do it:

```
## <span style="background-color: red;">Agenda (for instructor only)</span>
```

An ordinary heading that isn't instructor-only stays plain, without any colour:

```
## The Complete Architecture Flow
```

Any optional heading can be labelled in orange:

`<span style="color: orange;">(optional)</span>`

### Actionable examples

```
<span style="color: orange;">Doubt by Learner:</span>
* Demo
* Demo
```

```
<span style="color: orange;">Doubt by Learner (Optional):</span>
* Demo
* Demo
```

```
<span style="color: red;">Disclaimer:</span>
* Demo
* Demo
```

```
<span style="color: red;">Important:</span>
* Demo
* Demo
```

```
<span style="color: red;">Note:</span>
* Demo
* Demo
```

```
<span style="background-color: red;color: White;">Instructor Note:</span>

<span style="background-color: red;color: White;">**[Ask Learners]:**</span>
```

### Steps, in green

```
### Steps to use green color
* <span style="color: green;">Step 1</span>
* <span style="color: green;">Step 2</span>
```

### Question, in violet

The complete question should be in violet, on just the question heading:

`<span style="color: violet;">Question: ...</span>`

### Dataset link

`<span style="background-color: Blue;color:White;">Dataset link</span>`

### Uploading images

Upload images at https://www.scaler.com/admin/add_files/public-asset. (The pipeline itself never uploads an image on your behalf — a notebook's own plots always arrive as `![plot-N](image-placeholder)` and that placeholder must be kept exactly as given, never replaced with an invented link.)

### How to add images in Markdown

**Good practice** — an `<img>` tag with a width set:

`<img src="https://d2beiqkhq929f0.cloudfront.net/public_assets/assets/000/043/265/original/Screenshot_2023-08-18_at_4.18.55_PM.png?1692355744" width="500" />`

### How to add tables in Markdown

**Style block — once per file, inside the first card, never before it.** If the file has one or more tables, the very first thing in the **first card's body** — immediately after that card's closing `---`, before anything else — must be:

```html
<style>
table { border-collapse: collapse; }
table th, table td { border: 1px solid #94a3b8; padding: 6px 10px; }
table th { background:#1e3a8a; color:white; }
table td:nth-child(2) { font-weight:bold; }
</style>
```

`<style>` styles the whole file no matter which card's body it sits in — but the very top of the file, before the first card's own `---`, is off limits: putting anything there (including this block) stops that opening `---` from being recognized as the card's metadata delimiter at all, so the title/description/duration lines render as plain visible text instead of being read as the card's metadata. That breaks the first card outright, which is exactly why this must go inside it instead.

Worked example, showing the required placement:

```markdown
---
title: Agenda
description: Overview of topics covered
duration: 180
card_type: cue_card
---

<style>
table { border-collapse: collapse; }
table th, table td { border: 1px solid #94a3b8; padding: 6px 10px; }
table th { background:#1e3a8a; color:white; }
table td:nth-child(2) { font-weight:bold; }
</style>

## <span style="background-color: red;">Agenda (for instructor only)</span>

- First topic
- Second topic
```

Insert it once for the whole file, never once per table — it styles every table below it, in this card and every later one. If the file already has this block, don't add a second one. Don't add it to a file with no tables.

**Table syntax:** standard Markdown (GFM) — a header row plus a `|---|---|` separator row — never HTML `<table>` tags. Use alignment (`:---` left, `:---:` center, `---:` right) where it helps. Keep cell text short; move long explanations below the table rather than into a cell.

```
| user_id | name | phone | age |
| --- | --- | --- | --- |
| 1 | Akon | 9876723452 | 35 |
| 2 | Bkon | 9991165674 | 35 |
```

**Cell-level styling:** for coloured text inside a cell, use an inline span — `<span style="color:green">Hands-on</span>`. Use colour meaningfully and consistently: green = done/hands-on, red = blocked/failed, orange = partial. Don't add other inline styles, and don't change the style block's values, unless explicitly asked.

### Quiz cards: no extra text

---
title: Quiz 1
description: Optional description
duration: 120
card_type: quiz_card
---

# Question

Which of the following is correct

# Choices

- [ ] option 1
- [x] option 2
- [ ] option 3
````

There should not be any explanation or text inside a quiz cue card — only the question and choices.

### Don't leave content without a parent cue card

The text or content that sits between two cue cards, outside any `---` block, is shown to the instructor only. Make sure every piece of content lives inside a cue card — content with no parent cue card gets missed entirely.

### Code format


## SQL code
```sql=
write the query
here
```

## Python code
```python=
write the code
here
```
if language not known

```text=
Code
```


### DSML – DA track modules only

The following applies specifically to DSML DA-track modules. Reuse it as a template; only the practice-question link changes between lectures.


---
title: Unlock Assignment & ask learner to solve in live class
description:
duration: 1800
card_type: cue_card
---

* <span style="color:skyblue">Unlock the assignment for learners</span> by clicking the **"question mark"** button on the top bar.
<img src="https://d2beiqkhq929f0.cloudfront.net/public_assets/assets/000/078/685/original/Screenshot_2024-06-19_at_7.17.12_PM.png?1718804854" width=200 />
* If you face any difficulties using this feature, please refer to this video on how to unlock assignments.
* <span style="color:red">**Note:** The following video is strictly for instructor reference only. [VIDEO LINK](https://www.loom.com/share/15672134598f4b4c93475beda227fb3d?sid=4fb31191-ae8c-4b18-bf81-468d2ffd9bd4)</span>

### Conducting a Live Assignment Solution Session:
1. Once you unlock the assignments, ask if anyone in the class would like to solve a question live by sharing their screen.
2. Select a learner and grant permission by navigating to <span style="color:skyblue">**Settings > Admin > Unmuted Audience Can Share**, then select **Audio, Video, and Screen**.</span>
<img src="https://d2beiqkhq929f0.cloudfront.net/public_assets/assets/000/111/113/original/image.png?1740484517" width=400 />
3. Allow the selected learner to share their screen and guide them through solving the question live.
4. Engage with both the learner sharing the screen and other students in the class to foster an interactive learning experience.

### <span style="color: purple;">Practice Question</span>

You can pick the following question and solve it during the lecture itself.

This will help the learners to get familiar with the problem solving process and motivate them to solve the assignments.

<span style="background-color: red">**Make sure to start the doubt session before you start solving the question.**</span>

> Q. https://www.scaler.com/hire/test/problem/54464/ (Where !=): Emp 101 - Easy
````

Only this last question link changes from one lecture to another; everything else in the block above stays the same. Only replace it if the script itself gives you this lecture's real practice-question link — never invent or guess one. If the script doesn't provide one, leave the example link above as it is rather than making one up.

### DSML – SQL module only

The following applies specifically to the DSML SQL module.

````markdown
<span style="background-color: red">**Disclaimer:**</span> <span style="color:orange;">The text in orange</span>

## <font color='violet'>**Dialogue Template Starts:**</font>

**Instructor**:
**Learner**:
**Instructor**:

## <font color='violet'>**Dialogue Template Ends**</font>

<span style="background-color: red">**Instructor Note:**</span> <span style="color:orange;">The text in orange</span>

### <font color='green'>Formulating questions to be explored based on the data provided:</font>
````

## How to Format the Cue Card Content

The script content will be formatted using markdown and divided into two sections:

1. Meta Data Section: This will contain metadata related to the card, like the type of card, title, duration, etc.
2. Main Content Section: This will be the markdown content specific to the type of card.

### Cue Card Format

The markdown file for a single cue card should follow the format below.
The content between `---` is the metadata, which includes the following 4 attributes. Please note that new lines should not be added in attribute values:

- title: The title of the section to be shown on the cards. The title should be descriptive, like chapter names on YouTube, and not generic.
  - Good Example: "Problem - Longest Common Subsequence"
  - Bad Example: "Problem 1 - Optimized Solution"
- description: Any optional description you would want to show on the cards. This can be different from the content, as content will only be visible when the cue card is opened, and this will be visible always.
- duration (in seconds): The ideal estimated duration that the instructor should take to cover this content. As of now, this will be used only for analytical purposes, but later could be used to provide a nudge to the instructor if the need arises.
- card_type: This will be fixed to the value `cue_card` for all cue cards. This will help the script identify that this markdown file is for a cue card.

Keep the format the same as shared below:

- The title should never contain a colon or other special characters, not even a full stop (.). A single hyphen used as a separator (e.g. "Opening Hook - 10 Million Rows") is fine.
- Don't add a space before `:` but add one after it
- Always add a value for duration

Example:

````markdown
---
title: Introduction to Arrays
description: Optional description for introduction to arrays slide visible on card
duration: 300
card_type: cue_card
---

# Introduction to Arrays

Take this time to highlight all the topics that will be covered in the class as per the below list
- How are arrays stored
- How to read a value from an array
- How to read all values from an array
- How to write to an array
- Time complexities for different operations in arrays
````

### Quiz Card Format

The markdown file for a quiz card should follow the format below.

The content between `---` is the metadata, with the format being the same as the cue card except for the `card_type` value, which should be `quiz_card`.
To specify the content of the quiz question, add a markdown heading `# Question`. The question content will be added below this heading in markdown format and can span multiple lines.
To specify choices for the quiz, add a markdown heading `# Choices`. Choices will be added below this heading as a checklist.
The correct answer should be specified by marking the checklist with `x` to indicate it is correct (note that capital X will throw an error here). If multiple lines are required in the choice, please use the `<br>` tag, and there should be at least 2 choices and exactly one choice marked as the correct answer.

Example:

````markdown
---
title: Quiz-2
description: Optional description
duration: 45
card_type: quiz_card
---

# Question

What are the **time and space complexities** to create reverse version of input array?


# Choices

- [x] Time: O(n), Space: O(n)
- [ ] Time: O(n), Space: O(1)
- [ ] Time: O(1), Space: O(n)
- [ ] Time: O(1), Space: O(1)
````
