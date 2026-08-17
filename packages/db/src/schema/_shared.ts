import { sql } from "drizzle-orm";
import { pgSchema, timestamp, uuid } from "drizzle-orm/pg-core";

// Supabase Auth owns `auth.users`. We never create, alter, or drop it — this
// declaration exists only so our foreign keys can reference it and so
// drizzle-kit knows the table is out of its control.
export const authSchema = pgSchema("auth");

export const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey()
});

// Every table carries these. Written as a spread rather than a base table
// because Drizzle composes columns, not inheritance.
export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
};

// Postgres does not update `updated_at` on its own. The trigger is created in
// the migration; this is the function it calls.
export const TOUCH_UPDATED_AT = sql`
  create or replace function touch_updated_at()
  returns trigger as $$
  begin
    new.updated_at = now();
    return new;
  end;
  $$ language plpgsql;
`;
