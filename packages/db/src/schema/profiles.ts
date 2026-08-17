import { relations } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { authUsers, timestamps } from "./_shared";

// Product-owned fields for a signed-in user. The row's id *is* the Supabase
// auth user id — one row per account, created on first sign-in rather than by
// Supabase itself.
export const profiles = pgTable("profiles", {
  id: uuid("id")
    .primaryKey()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  // Wallet-only sign-in means there is no email to fall back on for a display
  // name, so both of these stay optional and user-set.
  handle: text("handle").unique(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  ...timestamps
});

export const wallets = pgTable(
  "wallets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    // Base58-encoded Solana public key, 32-44 characters.
    address: text("address").notNull(),
    label: text("label"),
    // The wallet that signed in, as opposed to ones added for watching.
    isPrimary: boolean("is_primary").notNull().default(false),
    // Null until the user proves ownership by signing a challenge. Watch-only
    // wallets stay unverified forever, which is a valid state.
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => [
    // The same address may legitimately appear under two profiles — one owner,
    // one watcher — so uniqueness is scoped to the profile rather than global.
    unique("wallets_profile_address_key").on(table.profileId, table.address),
    index("wallets_address_idx").on(table.address)
  ]
);

export const profilesRelations = relations(profiles, ({ many }) => ({
  wallets: many(wallets)
}));

export const walletsRelations = relations(wallets, ({ one }) => ({
  profile: one(profiles, {
    fields: [wallets.profileId],
    references: [profiles.id]
  })
}));
