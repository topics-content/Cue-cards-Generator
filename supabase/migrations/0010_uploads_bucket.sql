-- Private bucket for script uploads. The browser uploads here with a server-issued signed URL
-- (skipping Vercel's 4.5 MB request body limit); /api/parse downloads, parses and deletes the file.
-- No RLS policies on storage.objects for this bucket: only the service role can read or list it.
-- 20 MB per file (free plan allows up to 50 MB). Safe to re-run.
insert into storage.buckets (id, name, public, file_size_limit)
values ('uploads', 'uploads', false, 20971520)
on conflict (id) do update set public = false, file_size_limit = 20971520;
