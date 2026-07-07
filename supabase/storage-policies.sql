-- Run this in the Supabase SQL editor after creating the private bucket `guest-photos`.
-- The frontend can upload pending photos and read approved photos.
-- Approve/reject/list pending photos must happen through the `gallery-admin` Edge Function.

insert into storage.buckets (id, name, public)
values ('guest-photos', 'guest-photos', false)
on conflict (id) do update set public = false;

drop policy if exists "guest photos upload pending" on storage.objects;
drop policy if exists "guest photos read approved" on storage.objects;
drop policy if exists "guest photos read pending" on storage.objects;
drop policy if exists "guest photos update objects" on storage.objects;
drop policy if exists "guest photos delete objects" on storage.objects;

create policy "guest photos upload pending"
on storage.objects
for insert
to anon
with check (
  bucket_id = 'guest-photos'
  and split_part(name, '/', 1) = 'pending'
);

create policy "guest photos read approved"
on storage.objects
for select
to anon
using (
  bucket_id = 'guest-photos'
  and split_part(name, '/', 1) = 'approved'
);
