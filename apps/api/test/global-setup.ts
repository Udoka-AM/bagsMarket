import { readFileSync } from "node:fs";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const dbPackage = join(new URL(".", import.meta.url).pathname, "..", "..", "..", "packages", "db");

/**
 * Brings the test database up to the current schema.
 *
 * Reuses packages/db's Supabase bootstrap and its real migrations, so the API
 * suite runs against the same shape that ships — a migration that would break
 * production breaks here first.
 */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;

  if (!url) {
    throw new Error(
      "TEST_DATABASE_URL is not set. Start one with `docker compose up -d postgres`."
    );
  }

  const sql = postgres(url, { max: 1, onnotice: () => {} });

  try {
    await sql.unsafe(readFileSync(join(dbPackage, "test", "bootstrap.sql"), "utf8"));
    await migrate(drizzle(sql), { migrationsFolder: join(dbPackage, "migrations") });
  } finally {
    await sql.end();
  }
}
