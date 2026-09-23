# Cue Card Generator

Internal tool for Scaler's content team. Upload a lecture script (`.ipynb`, `.md`, `.docx` or a Google Doc), get HackMD cue cards that follow the SOP, and see what every deck cost.

- **Not an agent.** A fixed, two-phase pipeline: split the script into sections, generate every section's draft (Pass 1) in order, then audit every draft (Pass 2) against the SOP and source — with several audits running at once, since audits don't depend on each other. See "How it works" below.
- **Tiered spend caps: $3 → $5.** The server checks real spend before every call and pauses when the next call would pass the current cap. The user then chooses to continue to the next cap. $5 is an absolute maximum for one set of cue cards: it cannot be exceeded, not even by an admin.
- **Free hosting.** Vercel Hobby + Supabase free tier. The only paid item is LLM tokens.

## How it works

```
upload → /api/parse (strip notebook images, split into sections, estimate cost)
       → /api/decks (create deck)
       → /api/decks/[id]/prewarm (best-effort cache warm-up, never blocks)
       → Phase 1, generate: /api/decks/[id]/generate pass 1, one section at a time, in order
       → Phase 2, audit:    /api/decks/[id]/generate pass 2, up to 3 sections at once
       → /api/decks/[id]/finalize  (assemble output, set status)
       → /api/decks/[id]/reconcile (overwrite cost with OpenRouter's settled figure)
```

Every call is its own serverless request (each streamed, ≤300s), so no single function comes near Vercel Hobby's 300s limit. Phase 1 has to stay sequential — each section's continuity note (numbering, cross-references) is built from the *previous* section's own draft — but Phase 2's audits don't depend on each other at all, so several run concurrently (`AUDIT_CONCURRENCY` in `components/DeckRunner.tsx`, default 3). The accepted trade-off: a section's continuity note reflects the previous section's pre-audit draft, not its corrected version, so a rare wording drift in one section could be echoed by the next before Phase 2 catches it.

The server persists both Pass 1's draft and Pass 2's audited output separately (`deck_sections.draft_md` / `output_md`), so a budget stop or crash between the two phases never forces an already-paid-for Pass 1 call to be redone on resume.

Because several calls can now be in flight for the same set of cue cards at once, the $3/$5 check is a database-level reservation (`reserve_budget`/`release_budget_reservation` in migration `0006_concurrency.sql`), not a plain "read spend, then decide" — the latter has a real race under concurrency where several calls could each individually pass a stale check and collectively overshoot the cap.

Cost source of truth is the `usage.cost` OpenRouter returns, corrected later by `GET /generation?id=`.

**BYOK note:** if your OpenRouter key routes through your own provider key (`usage.is_byok: true`),
`usage.cost` is only OpenRouter's own service fee — free up to a monthly allowance, per
https://openrouter.ai/docs/features/byok — not what the provider actually charges. `lib/openrouter.ts`
adds `cost_details.upstream_inference_cost` on top in that case, so the app always records what you
really pay. Run `npm run check:billing` to see which mode your key is in. `lib/pricing.ts` is used only for the pre-generation estimate. Cost is always summed from `generations` (the `deck_costs` view); INR is `USD × INR_RATE` at display time.

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill it in (below)
npm run dev                  # http://localhost:3000
```

### 1. Supabase

1. Create a project at https://supabase.com (free plan).
2. **SQL Editor → New query**, and run each file in `supabase/migrations/` **in order**: `0001_init.sql`, `0002_deck_sections.sql`, `0003_source_and_ist_months.sql`, `0004_budget_tier.sql`, `0005_modules.sql`, `0006_concurrency.sql`.
3. **Project Settings → API Keys**:
   - `NEXT_PUBLIC_SUPABASE_URL` = the Project URL (`https://<ref>.supabase.co`, no path).
   - `SUPABASE_SERVICE_ROLE_KEY` = the **secret** key (`sb_secret_…`) or the legacy `service_role` key.
4. RLS is on with no policies and public grants are revoked, so the anon key can read nothing. All access goes through server route handlers using the service key. Never expose it to the client.

> Free Supabase projects pause after 7 days of inactivity. The daily reconcile cron (below) touches the database, which keeps the project awake in normal use.

### 2. Google OAuth

1. https://console.cloud.google.com → create a project.
2. **Google Auth Platform / OAuth consent screen**: app name "Cue Card Generator", audience **Internal** (limits sign-in to the Scaler Workspace).
3. **Clients → Create client → Web application**:
   - Authorised JavaScript origins: `http://localhost:3000`
   - Authorised redirect URIs: `http://localhost:3000/api/auth/callback/google`
4. Copy the Client ID and secret into `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
5. `NEXTAUTH_SECRET`: `openssl rand -base64 32`.

The app enforces `@scaler.com` itself in the `signIn` callback (`hd=scaler.com` is only a picker hint), so a non-Scaler account is rejected even if Google lets it through.

### 3. OpenRouter

Set `OPENROUTER_API_KEY`. `LLM_MODEL` is the exact slug from https://openrouter.ai/api/v1/models (currently `anthropic/claude-sonnet-4.6`; `lib/pricing.ts` has estimate rates for it and for `anthropic/claude-sonnet-5`, and an unknown slug is estimated at the pricier 4.6 rates); there is deliberately no model picker in the UI.

Prompt caching uses a 1-hour TTL (not OpenRouter's 5-minute default) so a late-queued audit call — several run concurrently, some waiting on a slot — doesn't fall out of the cache window and silently pay full price. **Before relying on the budget numbers, confirm prompt caching works through OpenRouter:**

```bash
npm run verify:caching
```

It makes two calls with an identical cached prefix and fails if the second reports zero cached tokens. If it fails, stop: without caching, per-class cost roughly doubles or worse.

### 4. Admins

`ADMIN_EMAILS` is a comma-separated list. Admins can open everyone's cue cards and continue a paused run on the creator's behalf (checked server-side). The **Cost Observatory** (costs by month, Program, module and user) is visible to every signed-in Scaler user; it shows costs only, and opening someone's cue cards is limited to their creator and admins.

## Spend caps

`DECK_BUDGET_USD` (default 3) is the first cap and `DECK_BUDGET_STEPS_USD` (default `5`) lists the further ones; the last is the absolute maximum. Each set of cue cards stores which tier it is on (`decks.budget_tier`), and only an explicit click on **Continue** (`POST /api/decks/[id]/continue`) raises it, one tier at a time.

The check runs *before* each call using `lib/pricing.ts`'s estimate, so a single call's real cost can land slightly above a cap if the estimate was low. A pause at a cap is meant to be a signal to investigate (an unusually long script, or caching not working), not a normal event. The Cost Observatory counts every set of cue cards that hit a cap, including ones that were later continued and finished.

## The SOP and examples

Edit these to change how cards are written; the app reads them at request time:

```
lib/sop/guidelines.md
lib/sop/examples/prose-source.md      lib/sop/examples/prose-cards.md
lib/sop/examples/notebook-source.md   lib/sop/examples/notebook-cards.md
```

Notebook uploads use the notebook pair; everything else uses the prose pair. The SOP and the chosen example pair are sent as a cached prefix on every call, so **keep the examples short**: a large example is re-read on every call and raises the per-class cost.

## Design system

"Graphite & Lime": a dark-technical look with light and dark themes that follow the OS.

- **Tokens** live as CSS variables in `app/globals.css` (one primary, one accent, neutrals, semantic ok/warn/danger/info). Change colours there and nowhere else.
- **Contrast:** every text pair is WCAG AA (≥ 4.5:1). `tests/contrast.test.ts` reads the CSS and fails if a token change breaks this.
- **Fonts:** IBM Plex Sans for text, IBM Plex Mono for numbers and labels (any `tabular-nums` or `uppercase` element is set in mono).
- **Theme switch:** a Light / System / Dark toggle in the header (and on the sign-in page) sets `data-theme` on `<html>` and remembers the choice in the browser; System follows the OS. A tiny inline script in `app/layout.tsx` applies it before first paint.
- **Spacing** follows an 8px grid. **States:** one focus ring (accent, 2px) everywhere; disabled controls are dimmed and show `not-allowed`; status colours always come with an icon and a label.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Unit tests (parsers incl. the real 850 KB notebook, chunker, card splitter, admin stats) |
| `npm run check:db` | Read-only check that every Supabase migration has been applied |
| `npm run check:billing` | See whether your key bills normally or via BYOK, and what that means for cost |
| `npm run verify:caching` | Live check that prompt caching passes through OpenRouter |
| `npm run build` | Production build |

## Deploy to Vercel

1. Push the repo to GitHub and import it in Vercel (Hobby plan).
2. **Settings → Functions**: make sure **Fluid compute** is on (300s max duration).
3. **Settings → Environment Variables**: add everything from `.env.example`, with:
   - `APP_URL` and `NEXTAUTH_URL` = your production URL (`https://<app>.vercel.app`)
   - `CRON_SECRET` = a random string (Vercel sends it as a Bearer token to the cron route)
4. In Google Cloud, add the production origin and `https://<app>.vercel.app/api/auth/callback/google` to the OAuth client.
5. Deploy. `vercel.json` schedules `/api/cron/reconcile` daily; Hobby allows one run per day, and each deck is also reconciled by the browser ~20s after it finishes.

## Notes

- Uploads are limited to 4 MB (Vercel's request body limit is 4.5 MB). Notebooks shrink ~20× after image stripping (855 KB → ~37 KB).
- Preview mode sanitises the HTML in cards: colour spans render, iframes (animations) do not. Raw mode and Copy always give the exact generated text.
- Out of scope for v1: in-app editing, publishing to HackMD, image hosting for notebook plots, a deterministic SOP validator.
