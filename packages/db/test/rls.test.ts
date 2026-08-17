import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";

const ALICE = "11111111-1111-1111-1111-111111111111";
const BOB = "22222222-2222-2222-2222-222222222222";

const sql = postgres(process.env.TEST_DATABASE_URL!, { max: 1, onnotice: () => {} });

/**
 * Runs a callback as `authenticated` with a given user's claims, then rolls
 * back. Rollback keeps every test independent despite sharing one database, and
 * SET LOCAL only takes effect inside a transaction -- outside one it is
 * silently ignored, which would make these tests pass while proving nothing.
 */
async function asUser<T>(userId: string, run: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
  let captured: T;

  try {
    await sql.begin(async (tx) => {
      await tx`select set_config('role', 'authenticated', true)`;
      await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`;
      captured = await run(tx);
      // Unwind so the fixtures stay pristine for the next test.
      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) {
      throw error;
    }
  }

  return captured!;
}

class Rollback extends Error {}

beforeAll(async () => {
  await sql`delete from auth.users where id in (${ALICE}, ${BOB})`;
  await sql`insert into auth.users (id) values (${ALICE}), (${BOB})`;
  await sql`insert into profiles (id, handle) values (${ALICE}, 'alice'), (${BOB}, 'bob')`;
  await sql`insert into launches (profile_id, name) values (${ALICE}, 'Alice Launch'), (${BOB}, 'Bob Launch')`;
  await sql`
    insert into fee_shares (launch_id, recipient_address, basis_points)
    select id, 'AliceRecipient', 5000 from launches where profile_id = ${ALICE}`;
  await sql`
    insert into alerts (profile_id, name, subject_type, subject_ref, rule)
    values (${ALICE}, 'Alice Alert', 'token', 'MINT_A', '{"gt": 1}'::jsonb)`;
  await sql`
    insert into alert_events (alert_id, payload)
    select id, '{"observed": 2}'::jsonb from alerts where profile_id = ${ALICE}`;
  await sql`insert into activity (profile_id, kind) values (${ALICE}, 'launch.created')`;
  await sql`insert into jobs (kind, status) values ('test.system.job', 'queued')`;
});

afterAll(async () => {
  await sql`delete from jobs where kind = 'test.system.job'`;
  // Cascades through profiles into every owned row.
  await sql`delete from auth.users where id in (${ALICE}, ${BOB})`;
  await sql.end();
});

describe("privilege setup", () => {
  // Guards the whole suite: if the grants vanish, every isolation test below
  // would still pass, but for the wrong reason.
  it("grants authenticated table access, so RLS is the deciding factor", async () => {
    const [row] = await sql<{ can_select: boolean }[]>`
      select has_table_privilege('authenticated', 'public.launches', 'SELECT') as can_select`;
    expect(row.can_select).toBe(true);
  });

  it("has RLS enabled on every public table", async () => {
    const rows = await sql<{ tablename: string }[]>`
      select c.relname as tablename from pg_class c
      where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and not c.relrowsecurity`;
    expect(rows).toEqual([]);
  });
});

describe("directly-owned tables", () => {
  it("shows a user only their own launches", async () => {
    const alice = await asUser(ALICE, (tx) => tx`select name from launches`);
    expect(alice.map((r) => r.name)).toEqual(["Alice Launch"]);

    const bob = await asUser(BOB, (tx) => tx`select name from launches`);
    expect(bob.map((r) => r.name)).toEqual(["Bob Launch"]);
  });

  it("shows a user only their own profile", async () => {
    const rows = await asUser(ALICE, (tx) => tx`select handle from profiles`);
    expect(rows.map((r) => r.handle)).toEqual(["alice"]);
  });

  it("shows a user only their own activity", async () => {
    expect(await asUser(ALICE, (tx) => tx`select id from activity`)).toHaveLength(1);
    expect(await asUser(BOB, (tx) => tx`select id from activity`)).toHaveLength(0);
  });
});

describe("tables owned through a parent", () => {
  it("scopes fee_shares by the owning launch", async () => {
    expect(await asUser(ALICE, (tx) => tx`select id from fee_shares`)).toHaveLength(1);
    expect(await asUser(BOB, (tx) => tx`select id from fee_shares`)).toHaveLength(0);
  });

  it("scopes alert_events by the owning alert", async () => {
    expect(await asUser(ALICE, (tx) => tx`select id from alert_events`)).toHaveLength(1);
    expect(await asUser(BOB, (tx) => tx`select id from alert_events`)).toHaveLength(0);
  });
});

describe("write protection", () => {
  it("rejects inserting a row owned by someone else", async () => {
    await expect(
      asUser(BOB, (tx) => tx`insert into launches (profile_id, name) values (${ALICE}, 'stolen')`)
    ).rejects.toThrow(/row-level security/i);
  });

  it("rejects reassigning your own row to another owner", async () => {
    await expect(
      asUser(BOB, (tx) => tx`update launches set profile_id = ${ALICE} where profile_id = ${BOB}`)
    ).rejects.toThrow(/row-level security/i);
  });

  it("does not let a user delete another user's row", async () => {
    const deleted = await asUser(
      BOB,
      (tx) => tx`delete from launches where name = 'Alice Launch' returning id`
    );
    // RLS filters the row out of the DELETE rather than raising -- the row
    // survives, which is the outcome that matters.
    expect(deleted).toHaveLength(0);
  });
});

describe("closed tables", () => {
  it("hides jobs entirely, since it has RLS on and no policy", async () => {
    expect(await asUser(ALICE, (tx) => tx`select id from jobs`)).toHaveLength(0);
  });

  it("denies authenticated any access to the migration journal", async () => {
    const [row] = await sql<{ usage: boolean }[]>`
      select has_schema_privilege('authenticated', 'drizzle', 'USAGE') as usage`;
    expect(row.usage).toBe(false);
  });
});
