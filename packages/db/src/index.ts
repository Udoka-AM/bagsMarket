import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export * from "./schema";
export { schema };

// Re-exported so consumers build queries without taking their own dependency on
// drizzle-orm — this package stays the single point where the ORM is pinned.
export {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  not,
  or,
  sql
} from "drizzle-orm";

export type Database = ReturnType<typeof createDatabase>;

/**
 * Opens a pooled connection for the running service.
 *
 * The API connects with a privileged role, so RLS does not constrain these
 * queries — every read and write must filter by profile explicitly. See the
 * ownership decision in docs/architecture.md.
 */
export function createDatabase(connectionString: string) {
  const client = postgres(connectionString, {
    // Supabase's transaction pooler does not support prepared statements.
    prepare: false
  });

  return drizzle(client, { schema });
}
