-- bellydontbully — Supabase setup
-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query).

-- 1. Table
create table if not exists public.cats (
  id bigint generated always as identity primary key,
  name text not null,
  location text not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  belly_status text not null check (belly_status in ('safe', 'caution', 'danger')),
  belly_text text not null,
  details text default '',
  photo_urls text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- If you already ran an earlier version of this file, this adds the new
-- photo column without touching existing rows.
alter table public.cats add column if not exists photo_urls text[] not null default '{}';

-- 2. Row Level Security
alter table public.cats enable row level security;

-- Anyone can read the cat pins (it's a public map)
drop policy if exists "Anyone can view cats" on public.cats;
create policy "Anyone can view cats"
  on public.cats for select
  using (true);

-- Anyone can add a new cat pin — this is a crowd-sourced app using the
-- public anon key. If you start seeing spam pins, tighten this later
-- (e.g. require auth, or add an `approved boolean default false` column
-- and only show approved rows to the select policy).
drop policy if exists "Anyone can insert cats" on public.cats;
create policy "Anyone can insert cats"
  on public.cats for insert
  with check (true);

-- 3. Realtime — lets everyone's map update live when a new cat is added
alter publication supabase_realtime add table public.cats;

-- 4. Storage bucket for cat photos (public read, public upload)
insert into storage.buckets (id, name, public)
values ('cat-photos', 'cat-photos', true)
on conflict (id) do nothing;

drop policy if exists "Public read for cat photos" on storage.objects;
create policy "Public read for cat photos"
  on storage.objects for select
  using (bucket_id = 'cat-photos');

drop policy if exists "Anyone can upload cat photos" on storage.objects;
create policy "Anyone can upload cat photos"
  on storage.objects for insert
  with check (bucket_id = 'cat-photos');
