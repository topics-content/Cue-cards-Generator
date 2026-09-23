-- Supports concurrent audit calls (see the two-phase generate/audit pipeline): a budget check
-- that only reads *committed* spend has a race when several calls check at once, so reservations
-- close it, and drafts are saved so a pause between the generate and audit phases never forces an
-- already-paid-for Pass 1 call to be redone.

-- Reserved (not-yet-settled) spend for in-flight calls. `spent + reserved_usd + next estimate` is
-- what a budget check must compare against the cap, not spent alone.
alter table public.decks add column if not exists reserved_usd numeric(10, 6) not null default 0;

-- Pass-1 draft, kept separate from the audited final output (deck_sections.output_md).
alter table public.deck_sections add column if not exists draft_md text;

-- output_md was `not null` with no default, written only once (after the audit) in the old
-- one-phase pipeline. A draft-only row (Phase 1 done, Phase 2 not yet) now needs to exist before
-- output_md has a real value, so give it a default; finalizeDeck and completedSectionIndexes treat
-- an empty output_md the same as "not yet audited".
alter table public.deck_sections alter column output_md set default '';

-- Atomically checks spent + already-reserved + this call's estimate against the cap, and reserves
-- it if it fits. `select ... for update` locks the deck row, so concurrent callers for the same
-- deck serialize here instead of each independently passing a stale check (the failure mode a
-- plain read-then-write pattern can't prevent under real concurrency).
create or replace function public.reserve_budget(p_deck_id uuid, p_amount numeric, p_budget numeric)
returns table(reserved boolean, spent numeric, reserved_total numeric)
language plpgsql
as $$
declare
  v_spent numeric;
  v_reserved numeric;
  v_ok boolean;
begin
  perform 1 from public.decks where id = p_deck_id for update;

  select coalesce(dc.total_cost_usd, 0) into v_spent
  from public.deck_costs dc where dc.deck_id = p_deck_id;
  v_spent := coalesce(v_spent, 0);

  select d.reserved_usd into v_reserved from public.decks d where d.id = p_deck_id;
  v_reserved := coalesce(v_reserved, 0);

  v_ok := (v_spent + v_reserved + p_amount) <= p_budget;
  if v_ok then
    update public.decks set reserved_usd = reserved_usd + p_amount where id = p_deck_id;
    v_reserved := v_reserved + p_amount;
  end if;

  return query select v_ok, v_spent, v_reserved;
end;
$$;

-- Releases a reservation once the call it was held for finishes, successfully or not. The real
-- cost, if any, lands separately in `generations` and is reflected in `deck_costs`.
create or replace function public.release_budget_reservation(p_deck_id uuid, p_amount numeric)
returns void
language sql
as $$
  update public.decks set reserved_usd = greatest(0, reserved_usd - p_amount) where id = p_deck_id;
$$;

revoke all on function public.reserve_budget(uuid, numeric, numeric) from anon, authenticated;
revoke all on function public.release_budget_reservation(uuid, numeric) from anon, authenticated;
