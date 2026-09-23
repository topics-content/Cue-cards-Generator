-- Cue Card Generator schema. Run in the Supabase SQL editor or via `supabase db push`.

create extension if not exists pgcrypto;

create table public.users (
  email      text primary key,
  name       text,
  is_admin   boolean not null default false,
  first_seen timestamptz not null default now(),
  last_seen  timestamptz not null default now()
);

create table public.decks (
  id                uuid primary key default gen_random_uuid(),
  created_by        text not null references public.users(email),
  created_at        timestamptz not null default now(),
  program           text not null,
  module            text not null,
  module_normalized text not null,
  class_name        text not null,
  input_type        text not null,             -- ipynb | md | docx | gdoc
  model             text not null,             -- recorded for audit, not user-selectable
  source_chars      int  not null default 0,
  status            text not null default 'pending'
                    check (status in ('pending', 'done', 'failed', 'budget_exceeded')),
  output_md         text not null default ''
);

create index decks_program_module_idx on public.decks (program, module_normalized);
create index decks_created_at_idx     on public.decks (created_at);
create index decks_created_by_idx     on public.decks (created_by);

-- One row per LLM call. Failed/retried calls still cost money, so no unique key on (deck, section, pass).
create table public.generations (
  id             uuid primary key default gen_random_uuid(),
  deck_id        uuid not null references public.decks(id) on delete cascade,
  section_index  int  not null,
  pass           int  not null check (pass in (1, 2)),
  model          text not null,                -- exact slug used for this call
  openrouter_id  text,
  input_tokens   int  not null default 0,
  output_tokens  int  not null default 0,
  cached_tokens  int  not null default 0,
  cost_usd       numeric(10, 6) not null default 0,
  reconciled     boolean not null default false,
  created_at     timestamptz not null default now()
);

create index generations_deck_idx       on public.generations (deck_id);
create index generations_reconcile_idx  on public.generations (created_at) where not reconciled;

-- Deck cost is always derived, never stored.
create view public.deck_costs with (security_invoker = true) as
select
  d.id as deck_id,
  coalesce(sum(g.input_tokens), 0)::bigint  as input_tokens,
  coalesce(sum(g.output_tokens), 0)::bigint as output_tokens,
  coalesce(sum(g.cached_tokens), 0)::bigint as cached_tokens,
  case when coalesce(sum(g.input_tokens), 0) = 0 then 0
       else round(100.0 * sum(g.cached_tokens) / sum(g.input_tokens), 1) end as cached_pct,
  coalesce(sum(g.cost_usd), 0)::numeric(12, 6) as total_cost_usd
from public.decks d
left join public.generations g on g.deck_id = d.id
group by d.id;

create view public.monthly_cost with (security_invoker = true) as
select
  date_trunc('month', d.created_at) as month,
  count(*)::int as deck_count,
  coalesce(sum(c.total_cost_usd), 0)::numeric(12, 6) as total_cost_usd
from public.decks d
join public.deck_costs c on c.deck_id = d.id
group by 1;

-- Server-side only: RLS on with no policies, and no grants for the public roles.
alter table public.users       enable row level security;
alter table public.decks       enable row level security;
alter table public.generations enable row level security;

revoke all on public.users, public.decks, public.generations,
              public.deck_costs, public.monthly_cost from anon, authenticated;
