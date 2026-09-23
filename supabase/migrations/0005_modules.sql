-- Saved module names per Program, so the form can offer them in a dropdown.
-- The first spelling used becomes the canonical one ("React Basics" and "react basics" are the same module).
create table if not exists public.modules (
  id              uuid primary key default gen_random_uuid(),
  program         text not null,
  name            text not null,
  name_normalized text not null,
  created_by      text references public.users(email),
  created_at      timestamptz not null default now(),
  unique (program, name_normalized)
);

create index if not exists modules_program_idx on public.modules (program);

-- Backfill from cue cards that already exist (newest spelling wins for these).
insert into public.modules (program, name, name_normalized, created_by)
select distinct on (program, module_normalized) program, module, module_normalized, created_by
from public.decks
order by program, module_normalized, created_at desc
on conflict (program, name_normalized) do nothing;

alter table public.modules enable row level security;
revoke all on public.modules from anon, authenticated;
