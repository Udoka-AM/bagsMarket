import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export * from "./schema";
export { schema };

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
