-- Finished section output, saved server-side as each section completes so a budget stop,
-- a dropped connection or a crash never loses completed work. decks.output_md is assembled from these.
create table public.deck_sections (
  deck_id       uuid not null references public.decks(id) on delete cascade,
  section_index int  not null,
  output_md     text not null,
  updated_at    timestamptz not null default now(),
  primary key (deck_id, section_index)
);

alter table public.deck_sections enable row level security;
revoke all on public.deck_sections from anon, authenticated;
