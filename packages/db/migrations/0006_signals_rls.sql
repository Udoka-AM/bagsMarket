-- Hand-written, as always: drizzle-kit does not generate RLS. Adding a table
-- without this leaves it open.

ALTER TABLE "watchlist_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "signal_snapshots" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- A watchlist is personal.
CREATE POLICY "watchlist_owner_all" ON "watchlist_items"
  FOR ALL TO authenticated
  USING (profile_id = (SELECT auth.uid()))
  WITH CHECK (profile_id = (SELECT auth.uid()));
--> statement-breakpoint

-- signal_snapshots deliberately gets no policy, like `jobs`. The rows carry no
-- profile_id — a public repository's star count is the same fact for everyone —
-- so there is no ownership expression to write. RLS-enabled-with-no-policy
-- closes the table to unprivileged roles, and the API returns snapshots only
-- for refs the caller actually follows.
