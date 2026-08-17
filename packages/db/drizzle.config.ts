import { defineConfig } from "drizzle-kit";

// Migrations run against DIRECT_URL, not DATABASE_URL: drizzle-kit needs an
// unpooled connection, and Supabase's transaction pooler cannot run DDL.
export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DIRECT_URL ?? ""
  },
  // `auth` belongs to Supabase. Without this, drizzle-kit would try to manage
  // auth.users and generate destructive DDL against it.
  schemaFilter: ["public"],
  verbose: true,
  strict: true
});
