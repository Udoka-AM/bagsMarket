import { readFileSync } from "node:fs";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const here = new URL(".", import.meta.url).pathname;

/**
 * Prepares a real Postgres for the RLS suite.
 *
 * Migrations are applied with drizzle's own migrator rather than by replaying
 * the SQL by hand, so the tests exercise the same files that ship to Supabase.
 * A migration that would fail in production fails here first.
 */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;

  if (!url) {
    throw new Error(
      "TEST_DATABASE_URL is not set. Start a database with `docker compose up -d postgres` " +
        "and see packages/db/README.md."
    );
  }

  const sql = postgres(url, { max: 1, onnotice: () => {} });

  try {
    await sql.unsafe(readFileSync(join(here, "bootstrap.sql"), "utf8"));

    await migrate(drizzle(sql), { migrationsFolder: join(here, "..", "migrations") });

    await sql.unsafe(readFileSync(join(here, "grants.sql"), "utf8"));
  } finally {
    await sql.end();
  }
}
