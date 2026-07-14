-- ─────────────────────────────────────────────────────────────
--  Tinker waitlist — database schema
--  Run this once in the Supabase SQL editor (Dashboard → SQL).
-- ─────────────────────────────────────────────────────────────

create table if not exists public.waitlist (
  id          bigint generated always as identity primary key,
  email       text not null,
  source      text,
  created_at  timestamptz not null default now()
);

-- Case-insensitive uniqueness → prevents duplicate signups.
-- A duplicate insert returns HTTP 409, which the API treats as "already joined".
create unique index if not exists waitlist_email_unique
  on public.waitlist (lower(email));

-- Lock the table down: only the server (service-role key) may read/write.
-- The public/anon key cannot touch it, so emails can't be scraped from the client.
alter table public.waitlist enable row level security;
-- (No policies are added, so with RLS on, anon/auth roles get zero access.
--  The service-role key used by the serverless function bypasses RLS.)
