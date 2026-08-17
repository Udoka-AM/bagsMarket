# @bagsmarkets/db

Drizzle schema and migrations for the Supabase-hosted Postgres database.

Server-side only. This package must never be imported by the web app — see the
decisions in [architecture.md](../../docs/architecture.md#phase-2-decisions).

## Layout

| Path | Contents |
| --- | --- |
| `src/schema/` | Table definitions, one file per domain area |
| `src/index.ts` | `createDatabase()` connection factory |
| `migrations/` | Generated and hand-written SQL |
| `drizzle.config.ts` | Points `drizzle-kit` at `DIRECT_URL` |

## Workflow

```bash
npm run db:generate   # diff schema -> new migration file
npm run db:migrate    # apply pending migrations
npm run db:studio     # browse data
```

`db:migrate` needs `DIRECT_URL` — the unpooled connection string. DDL cannot run
over Supabase's transaction pooler.

## Two conventions that will bite you otherwise

**1. The `auth` schema is not ours.** `src/schema/_shared.ts` declares
`auth.users` so foreign keys can reference it, but Supabase creates and owns that
table. `drizzle-kit generate` does not know this and will emit
`CREATE SCHEMA "auth"` plus a `CREATE TABLE "auth"."users"` in any migration that
first introduces the reference. Those statements were removed by hand from
`0000`, and the snapshot in `migrations/meta/` records the table as already
present — which is why regenerating is a no-op rather than a loop. If a future
migration ever emits auth DDL again, delete those statements before applying.

**2. `drizzle-kit` does not generate extensions, triggers, or RLS policies.**
They live in `0001_extensions_triggers_rls.sql`, which is maintained by hand and
registered manually in `migrations/meta/_journal.json`. **Adding a table means
editing that file too** — a new table with RLS left off is an open table.

## Ownership model

Every domain row carries `profile_id`. Enforcement happens twice:

- The API filters by the authenticated profile in every query. This is the
  control that must be correct.
- RLS policies are the backstop for anything reaching the database another way.
  The API connects with a privileged role and bypasses them entirely.

`jobs` deliberately has no policy: rows can be system-owned (`profile_id IS
NULL`), so enabling RLS without a policy closes the table to unprivileged roles.

## Token amounts

Stored as `numeric(40, 0)` and surfaced as **strings**. Solana u64 base units
exceed `Number.MAX_SAFE_INTEGER`; parsing them into a JS number loses precision
silently. Do not `Number()` them.
