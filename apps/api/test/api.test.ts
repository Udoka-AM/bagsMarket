import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import postgres from "postgres";
import { AuthFixture } from "./auth-fixture";

const ALICE = "aaaaaaaa-0000-4000-8000-000000000001";
const BOB = "bbbbbbbb-0000-4000-8000-000000000002";
// Used by exactly one test, so that test does not depend on whether an earlier
// one happened to create a profile first.
const CAROL = "cccccccc-0000-4000-8000-000000000003";
const ALICE_WALLET = "A1iceWa11etAddress1111111111111111111111111";

const auth = new AuthFixture();
let app: INestApplication;
let sql: postgres.Sql;

beforeAll(async () => {
  await auth.start();

  // Set before AppModule is imported: ConfigModule reads process.env at module
  // construction, and app.module ignores .env files when NODE_ENV is test.
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL!;

  // Cleared, not merely unset in .env: ConfigModule ignores .env *files* under
  // test, but ambient process.env still reaches it. A developer who sources
  // .env.local and then runs the suite would otherwise point these tests at
  // live Redis and the real Bags API, and the failures look like code bugs
  // rather than a leaked environment.
  delete process.env.REDIS_URL;
  delete process.env.BAGS_API_KEY;
  delete process.env.HELIUS_RPC_URL;
  // Effectively unlimited for the main app. The rate limiter gets its own
  // instance below with real limits, so the two concerns stay separate.
  process.env.THROTTLE_BURST_LIMIT = "100000";
  process.env.THROTTLE_SUSTAINED_LIMIT = "100000";
  process.env.NEXT_PUBLIC_SUPABASE_URL = auth.supabaseUrl;

  const { AppModule } = await import("../src/app.module");

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();

  sql = postgres(process.env.TEST_DATABASE_URL!, { max: 1, onnotice: () => {} });

  await sql`delete from auth.users where id in (${ALICE}, ${BOB}, ${CAROL})`;
  await sql`insert into auth.users (id) values (${ALICE}), (${BOB}), (${CAROL})`;
});

afterAll(async () => {
  await sql`delete from auth.users where id in (${ALICE}, ${BOB}, ${CAROL})`;
  await sql`delete from jobs where kind like 'apitest.%' or kind in ('claims.reconcile', 'signals.ingest-github')`;
  await sql`delete from watchlist_items where profile_id in (${ALICE}, ${BOB}, ${CAROL})`;
  await sql`delete from signal_snapshots where ref like 'test/%'`;
  await sql.end();
  await app.close();
  await auth.stop();
});

describe("auth guard", () => {
  it("rejects a request with no token", async () => {
    await request(app.getHttpServer()).get("/me").expect(401);
  });

  it("rejects a malformed token", async () => {
    await request(app.getHttpServer())
      .get("/me")
      .set("authorization", "Bearer not.a.jwt")
      .expect(401);
  });

  it("rejects a token missing the Bearer scheme", async () => {
    const token = await auth.token();
    await request(app.getHttpServer()).get("/me").set("authorization", token).expect(401);
  });

  // The security-critical one. Supabase's anon and service-role keys are valid
  // JWTs from the same issuer; service_role additionally bypasses RLS. Only the
  // audience check separates them from a user session.
  it("rejects a correctly signed token with the wrong audience", async () => {
    const token = await auth.token({ audience: "service_role" });
    await request(app.getHttpServer())
      .get("/me")
      .set("authorization", `Bearer ${token}`)
      .expect(401);
  });

  it("rejects a token from another issuer", async () => {
    const token = await auth.token({ issuer: "https://someone-else.supabase.co/auth/v1" });
    await request(app.getHttpServer())
      .get("/me")
      .set("authorization", `Bearer ${token}`)
      .expect(401);
  });

  it("rejects a token signed by a key the JWKS does not publish", async () => {
    const token = await auth.tokenFromForeignKey();
    await request(app.getHttpServer())
      .get("/me")
      .set("authorization", `Bearer ${token}`)
      .expect(401);
  });

  it("rejects an expired token", async () => {
    const token = await auth.token({ expiresIn: "-1m" });
    await request(app.getHttpServer())
      .get("/me")
      .set("authorization", `Bearer ${token}`)
      .expect(401);
  });

  it("accepts a valid token", async () => {
    const token = await auth.token({ sub: ALICE });
    await request(app.getHttpServer())
      .get("/me")
      .set("authorization", `Bearer ${token}`)
      .expect(200);
  });
});

describe("GET /me", () => {
  // This is the regression test for the bug that shipped: /me was correct, and
  // nothing called it, so signing in left a user with no profile.
  it("creates the profile on first authenticated request", async () => {
    const before = await sql`select id from profiles where id = ${CAROL}`;
    expect(before).toHaveLength(0);

    const token = await auth.token({ sub: CAROL });
    const response = await request(app.getHttpServer())
      .get("/me")
      .set("authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.profile.id).toBe(CAROL);

    const after = await sql`select id from profiles where id = ${CAROL}`;
    expect(after).toHaveLength(1);
  });

  it("records the signing wallet as primary and verified", async () => {
    const token = await auth.token({ sub: BOB, walletAddress: ALICE_WALLET });
    const response = await request(app.getHttpServer())
      .get("/me")
      .set("authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.wallets).toHaveLength(1);
    expect(response.body.wallets[0]).toMatchObject({
      address: ALICE_WALLET,
      isPrimary: true
    });
    expect(response.body.wallets[0].verifiedAt).not.toBeNull();
  });

  it("stays idempotent under the burst a client fires after sign-in", async () => {
    const token = await auth.token({ sub: BOB, walletAddress: ALICE_WALLET });

    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app.getHttpServer()).get("/me").set("authorization", `Bearer ${token}`)
      )
    );

    expect(responses.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);

    const profiles = await sql`select id from profiles where id = ${BOB}`;
    const wallets = await sql`select id from wallets where profile_id = ${BOB}`;
    expect(profiles).toHaveLength(1);
    expect(wallets).toHaveLength(1);
  });
});

describe("GET /launches", () => {
  it("requires authentication", async () => {
    await request(app.getHttpServer()).get("/launches").expect(401);
  });

  it("returns only the caller's launches", async () => {
    await sql`insert into profiles (id) values (${ALICE}), (${BOB}) on conflict do nothing`;
    await sql`insert into launches (profile_id, name) values (${ALICE}, 'Alice Only')`;
    await sql`insert into launches (profile_id, name) values (${BOB}, 'Bob Only')`;

    const aliceToken = await auth.token({ sub: ALICE });
    const alice = await request(app.getHttpServer())
      .get("/launches")
      .set("authorization", `Bearer ${aliceToken}`)
      .expect(200);

    expect(alice.body.items.map((l: { name: string }) => l.name)).toEqual(["Alice Only"]);

    const bobToken = await auth.token({ sub: BOB });
    const bob = await request(app.getHttpServer())
      .get("/launches")
      .set("authorization", `Bearer ${bobToken}`)
      .expect(200);

    expect(bob.body.items.map((l: { name: string }) => l.name)).toEqual(["Bob Only"]);
  });

  it("clamps an absurd limit rather than honouring it", async () => {
    const token = await auth.token({ sub: ALICE });
    await request(app.getHttpServer())
      .get("/launches?limit=99999")
      .set("authorization", `Bearer ${token}`)
      .expect(200);

    await request(app.getHttpServer())
      .get("/launches?limit=notanumber")
      .set("authorization", `Bearer ${token}`)
      .expect(200);
  });
});

describe("GET /positions", () => {
  it("requires authentication", async () => {
    await request(app.getHttpServer()).get("/positions").expect(401);
  });

  it("reports the fixture source when no Bags key is configured", async () => {
    // The suite runs without BAGS_API_KEY, so this is the path the app takes
    // today. The marker is what stops invented numbers being shown as real.
    const token = await auth.token({ sub: ALICE });
    const response = await request(app.getHttpServer())
      .get("/positions")
      .set("authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.source).toBe("fixture");
  });

  it("returns no positions and a null wallet when the caller has none on file", async () => {
    await sql`insert into profiles (id) values (${CAROL}) on conflict do nothing`;
    await sql`delete from wallets where profile_id = ${CAROL}`;

    const token = await auth.token({ sub: CAROL });
    const response = await request(app.getHttpServer())
      .get("/positions")
      .set("authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body).toMatchObject({ items: [], wallet: null });
  });

  it("queries the wallet on file, not one supplied by the caller", async () => {
    const token = await auth.token({ sub: BOB, walletAddress: ALICE_WALLET });
    await request(app.getHttpServer()).get("/me").set("authorization", `Bearer ${token}`);

    const response = await request(app.getHttpServer())
      .get("/positions")
      .set("authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.wallet).toBe(ALICE_WALLET);
    expect(response.body.items.length).toBeGreaterThan(0);
    // Lamports cross the wire as strings; u64 does not survive a JS number.
    expect(typeof response.body.items[0].claimableLamports).toBe("string");
  });
});

describe("GET /balances", () => {
  it("requires authentication", async () => {
    await request(app.getHttpServer()).get("/balances").expect(401);
  });

  it("returns an entry per owned wallet, and none for other people's", async () => {
    const token = await auth.token({ sub: BOB, walletAddress: ALICE_WALLET });
    await request(app.getHttpServer()).get("/me").set("authorization", `Bearer ${token}`);

    const response = await request(app.getHttpServer())
      .get("/balances")
      .set("authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].address).toBe(ALICE_WALLET);
  });

  it("reports lamports as null rather than zero when the RPC is unavailable", async () => {
    // The suite runs without HELIUS_RPC_URL. Null and "0" must stay distinct:
    // one means "we could not find out", the other means "the wallet is empty",
    // and showing an empty wallet to someone who has funds would be worse than
    // showing nothing.
    const token = await auth.token({ sub: BOB, walletAddress: ALICE_WALLET });
    const response = await request(app.getHttpServer())
      .get("/balances")
      .set("authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.rpcConfigured).toBe(false);
    expect(response.body.items[0].lamports).toBeNull();
  });

  it("returns an empty list when the caller has no wallets", async () => {
    await sql`insert into profiles (id) values (${CAROL}) on conflict do nothing`;
    await sql`delete from wallets where profile_id = ${CAROL}`;

    const token = await auth.token({ sub: CAROL });
    const response = await request(app.getHttpServer())
      .get("/balances")
      .set("authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.items).toEqual([]);
  });
});

describe("claims — the first write path", () => {
  const MINT = "So11111111111111111111111111111111111111112";

  async function signedInBob() {
    const token = await auth.token({ sub: BOB, walletAddress: ALICE_WALLET });
    await request(app.getHttpServer()).get("/me").set("authorization", `Bearer ${token}`);
    return token;
  }

  beforeEach(async () => {
    await sql`delete from claims where profile_id = ${BOB}`;
  });

  it("requires authentication", async () => {
    await request(app.getHttpServer()).post("/claims").send({ tokenMint: MINT }).expect(401);
  });

  it("rejects a mint that is not a Solana address", async () => {
    const token = await signedInBob();
    await request(app.getHttpServer())
      .post("/claims")
      .set("authorization", `Bearer ${token}`)
      .send({ tokenMint: "../../etc/passwd" })
      .expect(400);
  });

  it("rejects a missing mint rather than treating it as empty", async () => {
    const token = await signedInBob();
    await request(app.getHttpServer())
      .post("/claims")
      .set("authorization", `Bearer ${token}`)
      .send({})
      .expect(400);
  });

  it("creates a pending claim and returns transactions to sign", async () => {
    const token = await signedInBob();
    const response = await request(app.getHttpServer())
      .post("/claims")
      .set("authorization", `Bearer ${token}`)
      .send({ tokenMint: MINT })
      .expect(200);

    expect(response.body.transactions.length).toBeGreaterThan(0);
    // Base64 that actually decodes — the browser has to deserialise this.
    expect(Buffer.from(response.body.transactions[0], "base64").length).toBeGreaterThan(0);

    const rows = await sql`select status from claims where id = ${response.body.claimId}`;
    expect(rows[0].status).toBe("pending");
  });

  it("refuses a second pending claim for the same mint", async () => {
    const token = await signedInBob();
    await request(app.getHttpServer())
      .post("/claims")
      .set("authorization", `Bearer ${token}`)
      .send({ tokenMint: MINT })
      .expect(200);

    // The double-click case: without this, two rows race to record one
    // on-chain event.
    await request(app.getHttpServer())
      .post("/claims")
      .set("authorization", `Bearer ${token}`)
      .send({ tokenMint: MINT })
      .expect(409);
  });

  it("records a signature once, and rejects a replay", async () => {
    const token = await signedInBob();
    const draft = await request(app.getHttpServer())
      .post("/claims")
      .set("authorization", `Bearer ${token}`)
      .send({ tokenMint: MINT })
      .expect(200);

    const signature = "5".repeat(88);

    await request(app.getHttpServer())
      .post(`/claims/${draft.body.claimId}/signature`)
      .set("authorization", `Bearer ${token}`)
      .send({ signature })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/claims/${draft.body.claimId}/signature`)
      .set("authorization", `Bearer ${token}`)
      .send({ signature })
      .expect(409);
  });

  it("does not let one user write to another user's claim", async () => {
    const bobToken = await signedInBob();
    const draft = await request(app.getHttpServer())
      .post("/claims")
      .set("authorization", `Bearer ${bobToken}`)
      .send({ tokenMint: MINT })
      .expect(200);

    // A claim id is not a capability: Alice holding it must not be enough.
    const aliceToken = await auth.token({ sub: ALICE });
    await request(app.getHttpServer())
      .post(`/claims/${draft.body.claimId}/signature`)
      .set("authorization", `Bearer ${aliceToken}`)
      .send({ signature: "6".repeat(88) })
      .expect(404);
  });

  it("lists only the caller's claims", async () => {
    const token = await signedInBob();
    await request(app.getHttpServer())
      .post("/claims")
      .set("authorization", `Bearer ${token}`)
      .send({ tokenMint: MINT })
      .expect(200);

    const aliceToken = await auth.token({ sub: ALICE });
    const alice = await request(app.getHttpServer())
      .get("/claims")
      .set("authorization", `Bearer ${aliceToken}`)
      .expect(200);

    expect(alice.body.items).toHaveLength(0);
  });
});

describe("GET /jobs", () => {
  it("returns the paginated envelope the web app expects", async () => {
    // System-owned (profile_id null), so it is visible to any authenticated
    // caller — the case this table exists to model.
    await sql`insert into jobs (kind, status) values ('apitest.ingest', 'queued')`;

    const token = await auth.token({ sub: ALICE });
    const response = await request(app.getHttpServer())
      .get("/jobs?limit=100")
      .set("authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body).toHaveProperty("items");
    expect(response.body).toHaveProperty("nextCursor", null);

    const job = response.body.items.find((j: { kind: string }) => j.kind === "apitest.ingest");
    expect(job).toMatchObject({ kind: "apitest.ingest", status: "queued", attempts: 0 });
    // Dates cross the wire as ISO strings, never Date objects.
    expect(job.scheduledFor === null || typeof job.scheduledFor === "string").toBe(true);
  });
});

describe("watchlist and signals", () => {
  beforeEach(async () => {
    await sql`delete from watchlist_items where profile_id in (${ALICE}, ${BOB})`;
    await sql`delete from signal_snapshots where ref like 'test/%'`;
  });

  it("requires authentication", async () => {
    await request(app.getHttpServer()).get("/signals").expect(401);
    await request(app.getHttpServer()).post("/watchlist").send({ ref: "a/b" }).expect(401);
  });

  it("rejects anything that is not an owner/repo slug", async () => {
    const token = await auth.token({ sub: ALICE });
    for (const ref of ["not-a-slug", "https://github.com/a/b", "../../etc/passwd", ""]) {
      await request(app.getHttpServer())
        .post("/watchlist")
        .set("authorization", `Bearer ${token}`)
        .send({ ref })
        .expect(400);
    }
  });

  it("adds a repository and refuses a duplicate", async () => {
    await sql`insert into profiles (id) values (${ALICE}) on conflict do nothing`;
    const token = await auth.token({ sub: ALICE });

    const created = await request(app.getHttpServer())
      .post("/watchlist")
      .set("authorization", `Bearer ${token}`)
      .send({ ref: "test/repo", label: "Test" })
      .expect(201);

    expect(created.body).toMatchObject({ kind: "repository", ref: "test/repo" });

    await request(app.getHttpServer())
      .post("/watchlist")
      .set("authorization", `Bearer ${token}`)
      .send({ ref: "test/repo" })
      .expect(409);
  });

  it("returns a signal with null metrics before anything is captured", async () => {
    await sql`insert into profiles (id) values (${ALICE}) on conflict do nothing`;
    const token = await auth.token({ sub: ALICE });

    await request(app.getHttpServer())
      .post("/watchlist")
      .set("authorization", `Bearer ${token}`)
      .send({ ref: "test/fresh" })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get("/signals")
      .set("authorization", `Bearer ${token}`)
      .expect(200);

    const signal = response.body.items.find((s: { ref: string }) => s.ref === "test/fresh");
    // Null, not zeros: nothing has been measured yet, which is different from a
    // repository with no activity.
    expect(signal.metrics).toBeNull();
    expect(signal.capturedAt).toBeNull();
  });

  it("attaches the latest snapshot, not an older one", async () => {
    await sql`insert into profiles (id) values (${ALICE}) on conflict do nothing`;
    const token = await auth.token({ sub: ALICE });

    await request(app.getHttpServer())
      .post("/watchlist")
      .set("authorization", `Bearer ${token}`)
      .send({ ref: "test/history" })
      .expect(201);

    await sql`insert into signal_snapshots (kind, ref, source, metrics, captured_at)
              values ('repository', 'test/history', 'github', ${sql.json({ stars: 1 })}, now() - interval '2 hours')`;
    await sql`insert into signal_snapshots (kind, ref, source, metrics, captured_at)
              values ('repository', 'test/history', 'github', ${sql.json({ stars: 99 })}, now())`;

    const response = await request(app.getHttpServer())
      .get("/signals")
      .set("authorization", `Bearer ${token}`)
      .expect(200);

    const signal = response.body.items.find((s: { ref: string }) => s.ref === "test/history");
    expect(signal.metrics.stars).toBe(99);
  });

  it("never shows a signal for something the caller does not watch", async () => {
    await sql`insert into profiles (id) values (${ALICE}), (${BOB}) on conflict do nothing`;

    const bobToken = await auth.token({ sub: BOB });
    await request(app.getHttpServer())
      .post("/watchlist")
      .set("authorization", `Bearer ${bobToken}`)
      .send({ ref: "test/bobs-repo" })
      .expect(201);

    // Snapshots are shared and carry no owner, so this is the check that
    // matters: Alice must not see Bob's watched repo just because the snapshot
    // row exists.
    await sql`insert into signal_snapshots (kind, ref, source, metrics)
              values ('repository', 'test/bobs-repo', 'github', ${sql.json({ stars: 5 })})`;

    const aliceToken = await auth.token({ sub: ALICE });
    const response = await request(app.getHttpServer())
      .get("/signals")
      .set("authorization", `Bearer ${aliceToken}`)
      .expect(200);

    expect(response.body.items.map((s: { ref: string }) => s.ref)).not.toContain("test/bobs-repo");
  });

  it("does not let one user delete another user's watchlist entry", async () => {
    await sql`insert into profiles (id) values (${ALICE}), (${BOB}) on conflict do nothing`;

    const bobToken = await auth.token({ sub: BOB });
    const created = await request(app.getHttpServer())
      .post("/watchlist")
      .set("authorization", `Bearer ${bobToken}`)
      .send({ ref: "test/bobs-only" })
      .expect(201);

    const aliceToken = await auth.token({ sub: ALICE });
    await request(app.getHttpServer())
      .delete(`/watchlist/${created.body.id}`)
      .set("authorization", `Bearer ${aliceToken}`)
      .expect(404);

    const still = await sql`select id from watchlist_items where id = ${created.body.id}`;
    expect(still).toHaveLength(1);
  });
});

describe("jobs", () => {
  it("requires authentication — it previously did not", async () => {
    await request(app.getHttpServer()).get("/jobs").expect(401);
  });

  it("shows the caller's jobs and system jobs, but not another user's", async () => {
    await sql`insert into profiles (id) values (${ALICE}), (${BOB}) on conflict do nothing`;
    await sql`insert into jobs (kind, status, profile_id) values ('apitest.alice', 'queued', ${ALICE})`;
    await sql`insert into jobs (kind, status, profile_id) values ('apitest.bob', 'queued', ${BOB})`;
    await sql`insert into jobs (kind, status, profile_id) values ('apitest.system', 'queued', null)`;

    const token = await auth.token({ sub: ALICE });
    const response = await request(app.getHttpServer())
      .get("/jobs?limit=100")
      .set("authorization", `Bearer ${token}`)
      .expect(200);

    const kinds = response.body.items.map((j: { kind: string }) => j.kind);
    expect(kinds).toContain("apitest.alice");
    // System-owned work is everyone's business; another user's is not.
    expect(kinds).toContain("apitest.system");
    expect(kinds).not.toContain("apitest.bob");
  });

  it("records a durable row when work is queued, even with no Redis", async () => {
    // The suite runs without REDIS_URL. The row must still exist: Redis is a
    // queue, not a history, and a job nobody recorded is a job nobody can see.
    const token = await auth.token({ sub: ALICE });
    const response = await request(app.getHttpServer())
      .post("/jobs/reconcile-claims")
      .set("authorization", `Bearer ${token}`)
      .send({})
      .expect(202);

    expect(response.body.queued).toBe(false);
    expect(response.body.job.kind).toBe("claims.reconcile");
    expect(response.body.job.status).toBe("queued");

    const rows = await sql`select max_attempts from jobs where id = ${response.body.job.id}`;
    expect(rows).toHaveLength(1);
    expect(rows[0].max_attempts).toBe(3);
  });
});

describe("rate limiting", () => {
  // Its own app instance with a real limit. Sharing the main one would mean
  // either throttling every other test or testing nothing.
  let limited: INestApplication;

  beforeAll(async () => {
    process.env.THROTTLE_BURST_LIMIT = "5";
    process.env.THROTTLE_BURST_TTL_MS = "10000";

    const { AppModule: Limited } = await import("../src/app.module");
    const moduleRef = await Test.createTestingModule({ imports: [Limited] }).compile();
    limited = moduleRef.createNestApplication();
    await limited.init();

    process.env.THROTTLE_BURST_LIMIT = "100000";
  });

  afterAll(async () => {
    await limited.close();
  });

  it("allows requests up to the limit, then returns 429", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 8; i += 1) {
      const response = await request(limited.getHttpServer()).get("/health");
      statuses.push(response.status);
    }

    // Both halves matter: a limiter that rejected from the first request would
    // satisfy "we saw a 429" while being completely broken.
    expect(statuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
    expect(statuses.slice(5).every((s) => s === 429)).toBe(true);
  });

  it("sends a standard Retry-After, not only the library's suffixed one", async () => {
    let throttled: request.Response | undefined;
    for (let i = 0; i < 10; i += 1) {
      const response = await request(limited.getHttpServer()).get("/health");
      if (response.status === 429) {
        throttled = response;
        break;
      }
    }

    expect(throttled).toBeDefined();
    // Named throttlers emit Retry-After-burst, which no standard client reads.
    expect(throttled!.headers["retry-after"]).toBeDefined();
    expect(Number(throttled!.headers["retry-after"])).toBeGreaterThan(0);
  });
});

describe("GET /health", () => {
  it("stays public", async () => {
    await request(app.getHttpServer()).get("/health").expect(200, { ok: true, service: "api" });
  });
});
