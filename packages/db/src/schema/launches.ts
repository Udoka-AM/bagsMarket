import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles";
import { timestamps } from "./_shared";

export const launchStatus = pgEnum("launch_status", [
  "draft",
  "pending",
  "live",
  "failed",
  "closed"
]);

export const claimStatus = pgEnum("claim_status", ["pending", "confirmed", "failed"]);

// Token amounts are u64 base units, whose maximum exceeds a signed bigint. They
// are stored as exact numerics and surface as strings in TypeScript — never as
// JavaScript numbers, which would silently lose precision above 2^53.
const tokenAmount = (name: string) => numeric(name, { precision: 40, scale: 0 });

export const launches = pgTable(
  "launches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    // Identifier assigned by Bags. Null while a launch is still a local draft.
    bagsLaunchId: text("bags_launch_id"),
    // The SPL mint address. Null until the token actually exists onchain.
    tokenMint: text("token_mint"),
    name: text("name").notNull(),
    symbol: text("symbol"),
    status: launchStatus("status").notNull().default("draft"),
    launchedAt: timestamp("launched_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => [
    index("launches_profile_idx").on(table.profileId),
    index("launches_token_mint_idx").on(table.tokenMint),
    unique("launches_bags_id_key").on(table.bagsLaunchId)
  ]
);

// How a launch's fees are split. Basis points rather than percentages so splits
// stay exact under integer arithmetic.
export const feeShares = pgTable(
  "fee_shares",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    launchId: uuid("launch_id")
      .notNull()
      .references(() => launches.id, { onDelete: "cascade" }),
    recipientAddress: text("recipient_address").notNull(),
    basisPoints: integer("basis_points").notNull(),
    ...timestamps
  },
  (table) => [
    unique("fee_shares_launch_recipient_key").on(table.launchId, table.recipientAddress),
    // Per-row sanity only. That a launch's shares total 10000 is a cross-row
    // invariant Postgres cannot express in a CHECK, so the API enforces it.
    check("fee_shares_basis_points_range", sql`${table.basisPoints} between 0 and 10000`)
  ]
);

export const claims = pgTable(
  "claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Nullable: Bags reports claimable fees per mint, and we do not always have
    // a launch row for that mint — launches we know about are only the ones
    // created here. The claim stands on its own until a mint can be indexed
    // back to a launch.
    launchId: uuid("launch_id").references(() => launches.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    amount: tokenAmount("amount").notNull(),
    tokenMint: text("token_mint").notNull(),
    // Null while the transaction is still being built or sent. Once set, it is
    // unique — the guard against recording the same claim twice.
    txSignature: text("tx_signature"),
    status: claimStatus("status").notNull().default("pending"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => [
    unique("claims_tx_signature_key").on(table.txSignature),
    index("claims_launch_idx").on(table.launchId),
    index("claims_profile_idx").on(table.profileId)
  ]
);

export const launchesRelations = relations(launches, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [launches.profileId],
    references: [profiles.id]
  }),
  feeShares: many(feeShares),
  claims: many(claims)
}));

export const feeSharesRelations = relations(feeShares, ({ one }) => ({
  launch: one(launches, {
    fields: [feeShares.launchId],
    references: [launches.id]
  })
}));

export const claimsRelations = relations(claims, ({ one }) => ({
  launch: one(launches, {
    fields: [claims.launchId],
    references: [launches.id]
  }),
  profile: one(profiles, {
    fields: [claims.profileId],
    references: [profiles.id]
  })
}));
