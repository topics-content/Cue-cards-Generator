-- Holds a manually-edited version of a deck's cue cards, saved from the in-app validator once it
-- validates clean. When set, this takes over as the source of truth for display/copy/download and
-- for the completion check — but the original per-section generation record in deck_sections is
-- left untouched underneath it, so nothing about resuming or regenerating a deck is affected.
alter table public.decks add column if not exists edited_output_md text;
