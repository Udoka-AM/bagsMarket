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

## Tests

The RLS policies are the security boundary, so they are tested against a real
Postgres rather than reasoned about.

```bash
docker compose up -d postgres
npm test
```

`test/global-setup.ts` recreates the parts of Supabase our migrations assume
(the `auth` schema, `auth.uid()`, the `anon`/`authenticated` roles), applies
**every migration with drizzle's own migrator**, then grants the table
privileges Supabase grants by default.

Two details that make the suite meaningful rather than decorative:

- **The grants matter.** Without them, `authenticated` queries would fail on a
  missing privilege and every isolation test would pass for the wrong reason.
  One test asserts the grants exist, guarding the rest.
- **Each test runs in a rolled-back transaction.** `SET LOCAL` is silently
  ignored outside a transaction, so a test written without one would pass while
  proving nothing.

The suite has been checked against a deliberately broken policy
(`ALTER TABLE launches DISABLE ROW LEVEL SECURITY`) and correctly fails five
tests, including a cross-tenant delete that succeeds when RLS is off.

## Seed data

```bash
npm run db:seed
```

Requires `DATABASE_URL`, and a profile must already exist — sign in once first,
since the profile is created on the first authenticated request.

Every row uses a deterministic id in the `5eed…` range, and the script deletes
exactly those ids before re-inserting. That is what makes it safe to run against
a database holding real data: **it cannot touch a row it did not create**, and
running it three times leaves the same state as running it once. Children
(`fee_shares`, `alert_events`) cascade from their parents, so they need no ids
of their own.

`jobs` rows are seeded with `profile_id` null, because system-owned work is the
case that table exists to model — and the reason it carries no RLS policy.

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
