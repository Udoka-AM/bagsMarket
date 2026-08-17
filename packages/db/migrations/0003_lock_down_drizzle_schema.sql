-- Hand-written. Closes the migration journal to unprivileged roles.
--
-- The `drizzle` schema is not in the project's exposed-schemas list, so
-- PostgREST does not serve it and the anon key cannot reach it today. This is
-- defence in depth: it survives someone later adding `drizzle` to the exposed
-- list, or a direct connection made with a non-privileged role.
--
-- Safe for the migrator: the `postgres` role both has BYPASSRLS and owns the
-- table with FORCE ROW LEVEL SECURITY off, so RLS does not apply to it on two
-- independent counts. `drizzle-kit migrate` keeps working.

-- Row-level: no policy exists, and a table with RLS enabled and no policy denies
-- all access to non-exempt roles.
ALTER TABLE drizzle.__drizzle_migrations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- Privilege-level: the stronger of the two. RLS filters rows; this removes the
-- ability to reach the schema at all. Belt and braces, because the journal is
-- internal bookkeeping that no client role should ever touch.
REVOKE ALL ON ALL TABLES IN SCHEMA drizzle FROM anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON SCHEMA drizzle FROM anon, authenticated;
--> statement-breakpoint

-- Future tables in this schema inherit the same denial, so a later drizzle-kit
-- version adding a bookkeeping table does not silently open a hole.
ALTER DEFAULT PRIVILEGES IN SCHEMA drizzle REVOKE ALL ON TABLES FROM anon, authenticated;
