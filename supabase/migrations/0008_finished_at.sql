-- When a deck's run last reached a terminal state (done, failed, or paused at a budget cap) — set
-- by finalizeDeck() every time it runs, including on a resumed run's later completion. Lets "time
-- taken" be shown as finished_at - created_at instead of needing a run-duration column of its own.
alter table public.decks add column if not exists finished_at timestamptz;
