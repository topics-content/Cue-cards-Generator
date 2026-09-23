-- Which spend cap is in force for a set of cue cards: 0 = first cap ($3), 1 = second ($5), 2 = maximum ($7).
-- Only ever raised by an explicit "continue" click, so the cap can't creep up on its own.
alter table public.decks add column if not exists budget_tier int not null default 0;
