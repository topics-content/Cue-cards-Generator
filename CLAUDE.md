# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Internal Scaler tool: upload a lecture script (`.ipynb`, `.md`, `.docx`, Google Doc) and get HackMD cue cards that follow an SOP, with per-deck cost tracking. Next.js 14 App Router, Supabase (Postgres + Storage), NextAuth (Google), OpenRouter for the LLM. `README.md` covers setup, env vars, Supabase/Google/OpenRouter configuration and Vercel deploy.

## Commands

```bash
npm run dev                      # http://localhost:3000
npm run build
npm run lint                     # next lint
npx tsc --noEmit                 # typecheck (no npm script for it)
npm test                         # vitest run, whole suite
npx vitest run tests/cards.test.ts            # one file
npx vitest run tests/cards.test.ts -t "name"  # one test by name
```

Tests run in a node environment with dummy env vars (`tests/setup.ts`), so they never need real secrets. Scripts that hit real services read `.env.local` and are not part of `npm test`: `check:db` (are all migrations applied), `check:billing`, `verify:caching`, `compare:models`, `eval:models` (manual prompt/model comparison harness, writes to the gitignored `eval-results/`), `backfill:byok-cost`.

The `@/` alias maps to the repo root (tsconfig and vitest). `lib/sop/load.ts` is `server-only`, so scripts can't import it; `scripts/eval-models.ts` re-implements the SOP block loading. Keep the two in sync.

## Architecture

**The generation loop runs in the browser, not on the server.** `components/DeckRunner.tsx` orchestrates: Phase 1 generates every section's draft sequentially (each section's continuity note comes from the previous draft), Phase 2 audits all sections with `AUDIT_CONCURRENCY` (3) in flight. Each pass is its own streamed serverless request to `app/api/decks/[id]/generate` (NDJSON, `maxDuration = 300`), then `/finalize` and a delayed `/reconcile`. `lib/pipeline.ts` is the thin client-side fetch layer over these routes. Pass 1 drafts and Pass 2 output are stored separately (`deck_sections.draft_md` / `output_md`) so a stop or crash never repeats paid work.

**Spend caps are enforced in the database.** `lib/decks.ts::reserveBudget` / `releaseBudgetReservation` (migration `0006_concurrency.sql`) reserve estimated cost atomically before each call, because concurrent audits would race a plain read-then-decide check. Tiers come from `DECK_BUDGET_USD` + `DECK_BUDGET_STEPS_USD` (`lib/budget.ts`); only `POST /continue` raises a deck's tier, and the last tier is an absolute maximum. Real cost is whatever OpenRouter returns (`lib/openrouter.ts` adds upstream cost for BYOK keys), later overwritten by `reconcile`; `lib/pricing.ts` is only the pre-call estimate.

**The SOP is data, read from disk per request.** `lib/sop/guidelines.md` plus one example pair (`examples/notebook-*` for `.ipynb`, `examples/prose-*` for everything else) are sent as a cached system prefix on every call (`lib/sop/load.ts`), so keep examples short. `next.config.mjs` `outputFileTracingIncludes` is what makes Vercel bundle them. Prompts live in `lib/prompts.ts`. Why-each-change notes go in `lib/sop/CHANGELOG.md`, and non-trivial choices in `docs/decisions.md`. `npm test` does not evaluate prompt quality.

**Uploads** go browser to Supabase Storage via a signed URL (bypasses Vercel's 4.5 MB body limit, 20 MB cap in `lib/storage.ts`). `/api/parse` downloads, parses with `lib/parsers/*`, strips notebook images, splits via `lib/chunk.ts`, and deletes the file; the daily cron sweeps leftovers. Only parsed text is kept (`decks.source_md`).

**Auth and data access.** `middleware.ts` is only a coarse `@scaler.com` gate; every route handler re-checks with `requireUser()` / `requireAdmin()` (`lib/auth.ts`). Decks are visible to the creator and admins (`ADMIN_EMAILS`); non-owners get the same 404 as a missing id. All DB access goes through `lib/db.ts` with the service key from server code (RLS on, no policies), so never import it into client components.

### Where a deck's markdown comes from (easy to get wrong)

Three sources feed three views, and a fix in one does not reach the others:

- `/decks/[id]` (`DeckRunner` -> `OutputView`): joins `deck_sections.output_md` **client-side**, never reads `decks.output_md`. Live generation streams into this.
- `/decks/[id]/edit` (`DeckEditor`): starts from `decks.edited_output_md ?? decks.output_md`. `output_md` is assembled once by `finalizeDeck` (`lib/decks.ts`).
- `edited_output_md` is written raw by `saveEditedOutput` (no post-processing) and, once non-null, takes over as the displayed source everywhere.

Anything that must appear on every view (e.g. `addTableStyle`, `alignCardsToHeadings`) therefore has to be applied at display time as well as in `finalizeDeck`. Decks finalized before a post-processing change are never reprocessed. Structural steps (`alignCardsToHeadings`) must skip `edited_output_md`, since a person's saved edit is never restructured.

### Card boundaries

The model decides where `---` cards go, guided by the SOP; code only detects them (`frontmatterStarts` in `lib/cards.ts`: a `---` block counts as a card only if it contains `card_type:`). After generation, `alignCardsToHeadings` folds any card that doesn't match a source `##` heading into the card above it (heading kept as H3, durations summed; the target skips quiz and Explanation cards). It is a no-op when the source has no `##`, and quiz, "Quiz N Explanation", Agenda and Unlock Assignment cards are exempt. The SOP's "When to start a new cue card" and `notebook-cards.md` are written to produce the same shape, so keep the three in agreement.

### Tables and `<style>`

`addTableStyle` (`lib/cards.ts`) strips any model-written `<style>` block and inserts one `TABLE_STYLE` block directly above **every** GFM table (cards are copied individually). It never places one before the first card's opening `---`, which `lib/validateCards.ts` rejects. The in-app Preview (`MarkdownPreview`, rehype-sanitize) strips `<style>`, so the same look is duplicated as `.md-preview th` / `td:nth-child(2)` rules in `app/globals.css`; keep them in sync with `TABLE_STYLE`. The SOP tells the model never to write the block itself.

### Validator and editing

`lib/validateCards.ts` is a deterministic, LLM-free validator run in the browser (`DeckEditor`, Save is disabled until the latest Validate has zero errors) and again server-side in `app/api/decks/[id]/complete`, which is the only thing that can flip `review_status` to `completed`. The raw pane is CodeMirror 6 (`lib/markdownEditor.ts` for the editor, `lib/markdownGrammar.ts` for the static highlighter), not a WYSIWYG editor. There is no table-insert UI; tables are typed as GFM by hand.

## Gotchas

- `README.md` is partly stale: its migration list stops at `0006` (the real set is `supabase/migrations/0001`-`0010`; run `npm run check:db`), and its "out of scope" notes (in-app editing, deterministic validator) now exist.
- Colours come from CSS variables in `app/globals.css` only; `tests/contrast.test.ts` parses that file and fails if a token change drops below WCAG AA. Theme is applied by an inline script in `app/layout.tsx` before first paint.
- `LLM_MODEL` is an exact OpenRouter slug with no UI picker; `lib/pricing.ts` has rates for only a few, and unknown slugs are estimated at the pricier rate.
