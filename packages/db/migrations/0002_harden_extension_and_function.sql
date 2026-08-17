-- Hand-written. Fixes two items raised by the Supabase database linter after
-- 0001 was applied.

-- 1. `CREATE EXTENSION vector` with no schema lands it in `public`. Supabase
--    keeps extensions in a dedicated `extensions` schema so they do not share a
--    namespace with application tables. Moving it is trivial now and painful
--    later: once a column has type `vector`, the extension has dependents.
--    lint 0014_extension_in_public
ALTER EXTENSION vector SET SCHEMA extensions;
--> statement-breakpoint

-- 2. A function with a mutable search_path resolves unqualified names against
--    whatever the caller's search_path happens to be. For a trigger that fires
--    under other roles, that is a privilege-escalation shape: a caller could
--    put a malicious `now()` earlier in the path. Pinning search_path to empty
--    forces every reference to be schema-qualified, so `now()` becomes
--    `pg_catalog.now()`.
--    lint 0011_function_search_path_mutable
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = pg_catalog.now();
  RETURN NEW;
END;
$$;
