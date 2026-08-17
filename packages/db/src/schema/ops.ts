import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles";
import { timestamps } from "./_shared";

export const jobStatus = pgEnum("job_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
  "dead"
]);

// The durable record of background work. BullMQ (Phase 6) keeps its own queue
// state in Redis; this table is what survives a Redis flush and what the
// Workflows page reads. The two are deliberately not the same store.
export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Null for system-wide work that belongs to no single user.
    profileId: uuid("profile_id").references(() => profiles.id, { onDelete: "cascade" }),
    // e.g. "ingest.birdeye", "evaluate.alerts". Free text so adding a job type
    // does not require a migration.
    kind: text("kind").notNull(),
    status: jobStatus("status").notNull().default("queued"),
    payload: jsonb("payload"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    // Retained on failure so a dead job can be diagnosed without log archaeology.
    lastError: text("last_error"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => [
    // Supports the claim-next-job query: pending work of a kind, oldest first.
    index("jobs_status_kind_scheduled_idx").on(table.status, table.kind, table.scheduledFor),
    index("jobs_profile_idx").on(table.profileId)
  ]
);

// Append-only feed backing the dashboard. Rows are never updated, which is why
// there is no updated_at and no status column.
export const activity = pgTable(
  "activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    // e.g. "launch.created", "claim.confirmed", "alert.fired".
    kind: text("kind").notNull(),
    subjectType: text("subject_type"),
    subjectRef: text("subject_ref"),
    metadata: jsonb("metadata"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    // The feed is always read newest-first for one profile.
    index("activity_profile_occurred_idx").on(table.profileId, table.occurredAt)
  ]
);

export const jobsRelations = relations(jobs, ({ one }) => ({
  profile: one(profiles, {
    fields: [jobs.profileId],
    references: [profiles.id]
  })
}));

export const activityRelations = relations(activity, ({ one }) => ({
  profile: one(profiles, {
    fields: [activity.profileId],
    references: [profiles.id]
  })
}));
