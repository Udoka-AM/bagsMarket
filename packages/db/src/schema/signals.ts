import { relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles";
import { timestamps } from "./_shared";

/** What a watchlist entry points at. Tokens arrive with the market feeds. */
export const watchKind = pgEnum("watch_kind", ["repository", "token"]);

/**
 * Things a user is following.
 *
 * `ref` is deliberately untyped at the database level: a repository slug and a
 * mint address have nothing in common but being an identifier, and a column per
 * kind would be mostly nulls.
 */
export const watchlistItems = pgTable(
  "watchlist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    kind: watchKind("kind").notNull(),
    /** e.g. "anza-xyz/agave" for a repository, a mint address for a token. */
    ref: text("ref").notNull(),
    label: text("label"),
    ...timestamps
  },
  (table) => [
    // Following the same thing twice is a no-op, not two rows.
    unique("watchlist_profile_kind_ref_key").on(table.profileId, table.kind, table.ref),
    index("watchlist_profile_idx").on(table.profileId)
  ]
);

/**
 * A point-in-time measurement of something being watched.
 *
 * **No `profile_id` on purpose.** A public repository's star count is the same
 * fact for everyone; storing it per follower would multiply both the rows and
 * the API calls by the number of people watching. Ownership lives on
 * `watchlist_items`, and the API only ever returns snapshots for refs the
 * caller actually follows.
 *
 * Append-only, so it doubles as the history that trend detection will need —
 * "is this repo slowing down" is a question about two snapshots, not one.
 */
export const signalSnapshots = pgTable(
  "signal_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: watchKind("kind").notNull(),
    ref: text("ref").notNull(),
    /** Where it came from: "github", later "dexscreener", "birdeye". */
    source: text("source").notNull(),
    /**
     * Shape varies by source, so it stays jsonb rather than forcing every
     * feed into one column set. The API narrows it into a typed contract.
     */
    metrics: jsonb("metrics").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    // The hot read is "latest snapshot for this ref", newest first.
    index("signal_snapshots_ref_captured_idx").on(table.kind, table.ref, table.capturedAt)
  ]
);

export const watchlistItemsRelations = relations(watchlistItems, ({ one }) => ({
  profile: one(profiles, {
    fields: [watchlistItems.profileId],
    references: [profiles.id]
  })
}));
