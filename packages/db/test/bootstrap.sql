-- Recreates the parts of a Supabase project that our migrations assume already
-- exist. Without these, the migrations fail against a plain Postgres image and
-- the RLS tests cannot run at all.
--
-- Kept deliberately faithful: auth.uid() below is Supabase's real definition,
-- so a policy that works here works in production for the same reason.

create schema if not exists auth;
create schema if not exists extensions;

-- Supabase owns this table; we only reference it by foreign key.
create table if not exists auth.users (id uuid primary key);

-- Supabase's own implementation, reading either claim shape.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end
$$;
