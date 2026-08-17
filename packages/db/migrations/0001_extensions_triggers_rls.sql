-- Hand-written. drizzle-kit does not generate extensions, triggers, or RLS
-- policies, so this file is maintained directly and must be kept in step with
-- any new table added to src/schema.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

-- Enabled now, deliberately unused. Adding an extension to a live database is a
-- migration nobody wants to schedule later; the embedding schema itself waits
-- until Phase 5, when there is real content to model. See docs/architecture.md.
CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

-- Postgres does not touch updated_at on its own, and relying on the application
-- to set it means it is wrong the first time anyone writes a raw UPDATE.
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

-- `activity` is append-only and has no updated_at, so it is absent here.
CREATE TRIGGER profiles_touch_updated_at BEFORE UPDATE ON "profiles"
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
--> statement-breakpoint
CREATE TRIGGER wallets_touch_updated_at BEFORE UPDATE ON "wallets"
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
--> statement-breakpoint
CREATE TRIGGER launches_touch_updated_at BEFORE UPDATE ON "launches"
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
--> statement-breakpoint
CREATE TRIGGER fee_shares_touch_updated_at BEFORE UPDATE ON "fee_shares"
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
--> statement-breakpoint
CREATE TRIGGER claims_touch_updated_at BEFORE UPDATE ON "claims"
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
--> statement-breakpoint
CREATE TRIGGER alerts_touch_updated_at BEFORE UPDATE ON "alerts"
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
--> statement-breakpoint
CREATE TRIGGER alert_events_touch_updated_at BEFORE UPDATE ON "alert_events"
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
--> statement-breakpoint
CREATE TRIGGER jobs_touch_updated_at BEFORE UPDATE ON "jobs"
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
--
-- The API connects with a privileged role and therefore bypasses every policy
-- below. These are the backstop for anything that reaches the database by
-- another path -- a leaked anon key, a future direct-from-browser query, a
-- mistake in a worker. The API's own `where profile_id = ...` predicate is the
-- control that must actually be correct.
--
-- Enabling RLS without any policy denies all access to unprivileged roles, so
-- tables with no policy below are closed by default rather than open.

ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "wallets" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "launches" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fee_shares" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "claims" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "alerts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "alert_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "jobs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "activity" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- A profile row is readable and writable only by the account it belongs to.
-- Insert is excluded on purpose: profile creation happens on first sign-in
-- through the API, not from a client.
CREATE POLICY "profiles_self_select" ON "profiles"
  FOR SELECT TO authenticated USING (id = (SELECT auth.uid()));
--> statement-breakpoint
CREATE POLICY "profiles_self_update" ON "profiles"
  FOR UPDATE TO authenticated USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));
--> statement-breakpoint

-- Directly-owned tables: one policy each, covering all commands. WITH CHECK
-- matters as much as USING here -- without it a user could update a row they
-- own into being owned by somebody else.
CREATE POLICY "wallets_owner_all" ON "wallets"
  FOR ALL TO authenticated
  USING (profile_id = (SELECT auth.uid()))
  WITH CHECK (profile_id = (SELECT auth.uid()));
--> statement-breakpoint
CREATE POLICY "launches_owner_all" ON "launches"
  FOR ALL TO authenticated
  USING (profile_id = (SELECT auth.uid()))
  WITH CHECK (profile_id = (SELECT auth.uid()));
--> statement-breakpoint
CREATE POLICY "claims_owner_all" ON "claims"
  FOR ALL TO authenticated
  USING (profile_id = (SELECT auth.uid()))
  WITH CHECK (profile_id = (SELECT auth.uid()));
--> statement-breakpoint
CREATE POLICY "alerts_owner_all" ON "alerts"
  FOR ALL TO authenticated
  USING (profile_id = (SELECT auth.uid()))
  WITH CHECK (profile_id = (SELECT auth.uid()));
--> statement-breakpoint
CREATE POLICY "activity_owner_select" ON "activity"
  FOR SELECT TO authenticated USING (profile_id = (SELECT auth.uid()));
--> statement-breakpoint

-- Tables that reach their owner through a parent. The EXISTS subquery is why
-- launches_profile_idx and alerts_profile_idx matter for policy evaluation and
-- not just for application queries.
CREATE POLICY "fee_shares_owner_all" ON "fee_shares"
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM "launches" l
    WHERE l.id = "fee_shares".launch_id AND l.profile_id = (SELECT auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "launches" l
    WHERE l.id = "fee_shares".launch_id AND l.profile_id = (SELECT auth.uid())
  ));
--> statement-breakpoint
CREATE POLICY "alert_events_owner_select" ON "alert_events"
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM "alerts" a
    WHERE a.id = "alert_events".alert_id AND a.profile_id = (SELECT auth.uid())
  ));
--> statement-breakpoint

-- `jobs` has no policy by design. Rows can be system-owned (profile_id IS NULL)
-- and carry operational payloads, so unprivileged roles get nothing. The
-- Workflows page reads jobs through the API, which is privileged.
