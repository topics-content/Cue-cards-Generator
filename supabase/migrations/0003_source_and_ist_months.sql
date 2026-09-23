-- Keep the parsed source so a saved set of cue cards can show source + output side by side and be resumed.
alter table public.decks add column if not exists source_md text not null default '';

-- Months are calendar months in India time, matching how the team reads the Cost Observatory.
-- Dropped and recreated (not "create or replace") because the month column's type changes
-- from timestamptz to timestamp, which Postgres refuses to do in place. Safe to re-run.
drop view if exists public.monthly_cost;

create view public.monthly_cost with (security_invoker = true) as
select
  date_trunc('month', d.created_at at time zone 'Asia/Kolkata') as month,
  count(*)::int as deck_count,
  coalesce(sum(c.total_cost_usd), 0)::numeric(12, 6) as total_cost_usd
from public.decks d
join public.deck_costs c on c.deck_id = d.id
group by 1;

revoke all on public.monthly_cost from anon, authenticated;
