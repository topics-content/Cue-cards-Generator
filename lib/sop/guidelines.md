Lecture Script Technical Content Writing Guidelines
aka Cue Card Creation Guidelines.

## Writing Guidelines

### Content

- Never add a line, note or instruction the source doesn't contain, including Instructor Notes.
- Add a link only when the script gives the URL. If the script names a resource without a URL, keep its text and add no link.
- Use Punctuation Correctly: Correct punctuation usage ensures that the content flows well and is easy to read.
- Structuring: Ensure the content is well-structured with proper headings and subheadings.
- Use `>` as a block wherever adding a Scenario or Action for Instructor.

### Formatting

- Don't Skip Any Part of the Session: 100% coverage of the source script is important unless mentioned by the module owner. This includes hints/doubts/stories/comparisons and observations that are crucial for the understanding of the topic.
- Highlight Important Points/Words: Use bold or italic formatting to emphasize important points or words.
- Bullets Over Paragraphs: Where possible, use bullet points instead of long paragraphs to make the content more digestible.
- Images: every image in the script becomes an `<img>` tag with `width="500"`.
  - If the script gives the image's URL, use that exact URL.
  - If it doesn't — including `![plot-N](image-placeholder)` images and blank image slots — use exactly:
    `<img src="https://d2beiqkhq929f0.cloudfront.net/public_assets/assets/000/243/122/original/Screenshot_2026-09-28_at_18.15.19.png?1790599543" alt="image-N" width="500" />`
  - Number N in order across the file (image-1, image-2, ...).
  - Never write any other image URL. The only exception is the Unlock Assignment template's own two images.
  - Never replace text, a table, a code block or a text diagram with an image — keep the source's text.

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
## Introduction

So, we have a thing called Prefix Sum, in the field of data structures and algorithms, it is a method that modifies an array so that the element at each index 'i' in the new array is the sum of the elements from '0' to 'i' in the old array.

## Importance of Prefix Sum

The Prefix Sum concept is really important because it can solve many problems more efficiently, especially the ones that need to get cumulative sums. It can help us make algorithms run faster, which is always good.

## Key Points

There are things you should remember about Prefix Sum:
- firstly, it is also called a cumulative array
- secondly, it's a quick way to get cumulative sums of arrays which is useful for a lot of problems

## Steps to Calculate Prefix Sum

Calculating Prefix Sum goes like this:
- firstly, we take the first element of the old array and put it as the first element of the new array
- secondly, we take the current element in the old array and add it to the last element in the new array, then put this sum in the new array
- thirdly, we do the second step again and again for all the elements

Understanding the prefix sum will help you design better algorithms, so try using it in different problems to get good at it.
````

Note for Writers:

Notice that not one word changed between the two — no "cleaning up" the casual phrasing, no shortening, no making it sound more formal. The only things that changed are structural: headings were added, and the "firstly / secondly / thirdly" runs were split into bullets at their own existing boundaries. That's the only kind of change this pipeline ever makes to a script's own wording — restructuring, never rewording, no matter how repetitive or casual the source sounds.

## Code blocks

Code, URLs, LaTeX and identifiers (table, column, function and file names) are copied byte-for-byte from the source. Typo fixes never apply inside them — not even an obvious-looking one like a stray space or a doubled character.

### Inline code (single backticks)

Wrap these in single backticks, even when the source has them as plain text:

- A single line of code inside prose: `` `WHERE city = 'Bangalore'` ``, `` `ROUND(value, 1)` ``
- A keyword or special character: `for`, `if-else`, `int`, `__init__`, `%`, `||` (a math symbol that is already LaTeX in the source stays LaTeX — see Math below)
- Any word containing an underscore: `order_value`, `hello_how_areyou`, `__init__`

Adding backticks is the one change allowed around code — the code inside them stays byte-for-byte. The only exception: a markdown escape backslash (`\'`) is dropped inside backticks, since it would otherwise show up literally.

### Math

LaTeX stays LaTeX — copy the source's `$…$` and `$$…$$` exactly (`$z_1$`, `$\hat{y}_i$`); never turn it into inline code or plain text. Only math that is bare text in the source (e.g. `z_Paper = 2`) may be wrapped in backticks. Never leave a math symbol as bare text.

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

Use the source's width and height when given (e.g. a notebook `IFrame(..., height=1000)` becomes `height="1000"`). Only when the source gives none, use `width="100%" height="700"` as above.

## How to Write Actionables

Every label in the source maps to exactly one output. Copy the span exactly as shown — same style string, same spacing.

| Source label | Output |
| --- | --- |
| `Instructor Note -`, `Instructor cue`, `Note for Instructor` | `<span style="background-color: red;color: White;">Instructor Note:</span>` + text |
| `Question to the class`, `Ask Learners` | `<span style="background-color: red;color: White;">Question to the class</span>` + text |
| `Doubt by Learner` | `<span style="color: orange;">Doubt by Learner:</span>` + text |
| `Important`, `Note`, `Disclaimer` | `<span style="color: red;">Important:</span>` + text — using the source's own word (`Note:`, `Disclaimer:`) |
| `Question:` (an open question, no options) | `<span style="color: violet;">Question: …</span>` — the whole question inside the span |
| `Dataset` | `<span style="background-color: Blue;color:white">Dataset:</span>` + the source's text, or its link only if the script gives a URL |

- Only the label goes inside the span; the text follows after `</span>`. The one exception is the violet open question, which wraps the whole question. Right: `<span style="background-color: red;color: White;">Instructor Note:</span> This class assumes...` Wrong: wrapping the whole note in the span, which turns every line of it red.
- The source's own label words are replaced by the output label — never write both (not "Instructor Note: Instructor cue …").
- A question followed by lettered options is a quiz card, not a violet line — see "When a question becomes a quiz card".
- If several statements follow a label, keep them as bullets under it; a single statement stays on the label's line.
- A bracketed instructor cue that doesn't match any label above (e.g. `[WAIT FOR ANSWERS]`, `[REVEAL ANSWER]`) is never a reason to drop it — keep it as plain bracketed text exactly as written.

### Heading levels

No lecture-title heading — cue cards start directly with the first card's metadata. The card's `title:` metadata already names it; the body doesn't need to repeat that name as its own heading unless the card has exactly one extra aside worth calling out (see the second example below). Use H2 for whatever heading actually starts the card's real content; use H3, and H4 if it's needed, for genuine subsections nested under that. `#` (H1) appears only as `# Question` / `# Choices` in quiz cards — never in a cue card.

```
## The Complete Architecture Flow
```

### Lines that are dropped

These scaffolding lines from the script never become card content:

- The lecture header / title line (e.g. "Lecture 3  —  Data Filtering with SQL", or a notebook's opening `# …` title)
- The program line (e.g. "DSML  ·  Scaler 3.0  ·  120 min class  +  30 min doubts")
- Hour banners and their subtitle lines (e.g. "HOUR 1  —  Filtering", "WHERE · AND/OR/NOT · IN · BETWEEN · IS NULL")
- Per-segment timing lines (e.g. "7 min", "5 min  ·  informal") — the timing goes into that card's `duration`, in seconds (7 min → `duration: 420`)
- Document-export leftovers: "Tab 1" / "Tab 2" markers, `________________` separators, and a doc's own framing line such as "Here are the quiz questions for the specified sections."

This is the only exception to heading survival and to "don't drop content". An Agenda table in the source still stays a table, times included.

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

### Steps, in green

```
### Steps to use green color
* <span style="color: green;">Step 1</span>
* <span style="color: green;">Step 2</span>
```

### How to add images in Markdown

An `<img>` tag with `width="500"`. When the script gives no URL, use the placeholder (see "Images" under Formatting), numbering N in order across the file:

`<img src="https://d2beiqkhq929f0.cloudfront.net/public_assets/assets/000/243/122/original/Screenshot_2026-09-28_at_18.15.19.png?1790599543" alt="image-N" width="500" />`

### How to add tables in Markdown

**Never write a `<style>` block.** The pipeline adds the table styling to the file itself, once, after all sections are generated.

**A source table stays a GFM table.** Never convert it to an image or a list, and keep every row and column — including times in an agenda table.

**Table syntax:** standard Markdown (GFM) — a header row plus a `|---|---|` separator row — never HTML `<table>` tags. Use alignment (`:---` left, `:---:` center, `---:` right) where it helps.

```
| user_id | name | phone | age |
| --- | --- | --- | --- |
| 1 | Akon | 9876723452 | 35 |
| 2 | Bkon | 9991165674 | 35 |
```

**Cell-level styling:** for coloured text inside a cell, use an inline span — `<span style="color:green">Hands-on</span>`. Use colour meaningfully and consistently: green = done/hands-on, red = blocked/failed, orange = partial. Don't add other inline styles unless explicitly asked.

### Quiz cards: no extra text

````markdown
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

### When a question becomes a quiz card

A question followed by lettered options (`A)`, `(A)`, `A.` …) is a `quiz_card` — even when the source labels it `Question:` or `**Question:**` instead of Quiz. An open question with no options stays a violet line inside a cue card.

- Drop the letter prefixes from the choices. Question and choice text are copied word for word, punctuation included — never add, drop or change a character, even a trailing full stop. The only addition allowed is backticks around code, per "Inline code" above.
- When the source gives a correct answer (`Correct Answer: C. 6`, `Correct Answer: (B)`, or inside a note), mark that option `[x]`. Also open the `Quiz N Explanation` cue card, right after the quiz, with `**Correct Answer:** <option text>` — the option's text only, dropping the letter and any brackets around it.
- Any explanation the source gives follows that line in the same card, word for word.
- If the source has a correct answer but no explanation, the explanation card holds only the `**Correct Answer:**` line.
- If the source has neither an answer nor an explanation, there is no explanation card, and every choice stays `[ ]`. Never guess the answer — the validator flags it and a reviewer marks it.

### Don't leave content without a parent cue card

The text or content that sits between two cue cards, outside any `---` block, is shown to the instructor only. Make sure every piece of content lives inside a cue card — content with no parent cue card gets missed entirely.

### Code format

Use the language after the opening fence, followed by `=`. If the language isn't known, use `text=`.

`````markdown
```sql=
write the query
here
```

```python=
write the code
here
```

```text=
Code
```
`````

### Unlock Assignment card (only when the script has an unlock-assignment part)

Add this card only when the script itself contains an unlock-assignment part — the script says to unlock the assignment for learners, or to have a learner solve an assignment question live in class. Never add it because of the program or module, and never add it to a script that has no such part. When it applies, that part of the script becomes this card: use the template below, and keep any of the script's own lines about it that the template doesn't already say. Only the practice-question link changes between lectures.

````markdown
---
title: Unlock Assignment & ask learner to solve in live class
description:
duration: 1800
card_type: cue_card
---

* <span style="color:skyblue">Unlock the assignment for learners</span> by clicking the **"question mark"** button on the top bar.
<img src="https://d2beiqkhq929f0.cloudfront.net/public_assets/assets/000/078/685/original/Screenshot_2024-06-19_at_7.17.12_PM.png?1718804854" width=200 />
* If you face any difficulties using this feature, please refer to this video on how to unlock assignments.
* <span style="color: red;">Note:</span> The following video is strictly for instructor reference only. [VIDEO LINK](https://www.loom.com/share/15672134598f4b4c93475beda227fb3d?sid=4fb31191-ae8c-4b18-bf81-468d2ffd9bd4)

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

Only this last question link changes from one lecture to another; everything else in the block above stays the same. Only replace it if the script itself gives you this lecture's real practice-question link — never invent or guess one. If the script gives no link, replace the whole `> Q. …` line with `<span style="background-color: red;color: White;">**[PRACTICE LINK NEEDED]**</span>`.

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

## Introduction to Arrays

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
title: Quiz 2
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
