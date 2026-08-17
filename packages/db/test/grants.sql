-- Mirrors the table privileges Supabase grants to anon/authenticated by default.
--
-- This runs AFTER the migrations, and it matters more than it looks: without
-- these grants every query by `authenticated` would fail on a missing
-- privilege, and the RLS tests would pass for entirely the wrong reason. With
-- them, row visibility is decided by policy alone -- which is what we want to
-- assert.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
