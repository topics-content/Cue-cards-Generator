-- Human verification state, separate from generation `status`. Generation tracks whether the LLM
-- pipeline finished; review_status tracks whether a person has run the (LLM-free, rule-based) cue
-- card validator against the result and it came back clean. Only the /complete route is allowed to
-- set it to 'completed' — it re-validates output_md itself rather than trusting the client.
alter table public.decks add column if not exists review_status text not null default 'draft'
  check (review_status in ('draft', 'completed'));
