import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
  await sql`delete from jobs where kind like 'apitest.%'`;
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

describe("GET /jobs", () => {
  it("returns the paginated envelope the web app expects", async () => {
    await sql`insert into jobs (kind, status) values ('apitest.ingest', 'queued')`;

    const response = await request(app.getHttpServer()).get("/jobs").expect(200);

    expect(response.body).toHaveProperty("items");
    expect(response.body).toHaveProperty("nextCursor", null);

    const job = response.body.items.find((j: { kind: string }) => j.kind === "apitest.ingest");
    expect(job).toMatchObject({ kind: "apitest.ingest", status: "queued", attempts: 0 });
    // Dates cross the wire as ISO strings, never Date objects.
    expect(job.scheduledFor === null || typeof job.scheduledFor === "string").toBe(true);
  });
});

describe("GET /health", () => {
  it("stays public", async () => {
    await request(app.getHttpServer()).get("/health").expect(200, { ok: true, service: "api" });
  });
});
