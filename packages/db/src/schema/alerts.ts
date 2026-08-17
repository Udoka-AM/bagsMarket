import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles";
import { timestamps } from "./_shared";

// What an alert watches. Kept as an enum plus a free-text reference rather than
// separate FK columns per type, because the subjects live in different systems
// and most of them have no local table.
export const alertSubject = pgEnum("alert_subject", [
  "launch",
  "token",
  "wallet",
  "repository"
]);

export const alertChannel = pgEnum("alert_channel", ["in_app", "email", "webhook"]);

export const deliveryStatus = pgEnum("delivery_status", [
  "pending",
  "delivered",
  "failed"
]);

export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    subjectType: alertSubject("subject_type").notNull(),
    // A mint address, repo slug, wallet address, or launch id, depending on
    // subjectType. Deliberately untyped at the database level.
    subjectRef: text("subject_ref").notNull(),
    // The threshold expression. Held as jsonb because the rule shape differs per
    // subject type and will keep changing through Phase 4; the API validates it.
    rule: jsonb("rule").notNull(),
    channel: alertChannel("channel").notNull().default("in_app"),
    isActive: boolean("is_active").notNull().default(true),
    // Set while snoozed; the evaluator skips alerts muted into the future.
    mutedUntil: timestamp("muted_until", { withTimezone: true }),
    lastFiredAt: timestamp("last_fired_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => [
    index("alerts_profile_idx").on(table.profileId),
    // The evaluator sweeps active alerts by subject, so this is the hot path.
    index("alerts_active_subject_idx").on(table.isActive, table.subjectType, table.subjectRef)
  ]
);

// One row per firing. Separate from `alerts` so history survives the rule being
// edited or deleted, which is what makes "why did this fire?" answerable.
export const alertEvents = pgTable(
  "alert_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    alertId: uuid("alert_id")
      .notNull()
      .references(() => alerts.id, { onDelete: "cascade" }),
    firedAt: timestamp("fired_at", { withTimezone: true }).notNull().defaultNow(),
    // The observed values that tripped the rule, kept so an explanation can be
    // reconstructed without re-querying the upstream feed.
    payload: jsonb("payload").notNull(),
    deliveryStatus: deliveryStatus("delivery_status").notNull().default("pending"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    // Populated in Phase 5. Null means nobody has explained this firing yet.
    explanation: text("explanation"),
    ...timestamps
  },
  (table) => [index("alert_events_alert_fired_idx").on(table.alertId, table.firedAt)]
);

export const alertsRelations = relations(alerts, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [alerts.profileId],
    references: [profiles.id]
  }),
  events: many(alertEvents)
}));

export const alertEventsRelations = relations(alertEvents, ({ one }) => ({
  alert: one(alerts, {
    fields: [alertEvents.alertId],
    references: [alerts.id]
  })
}));
