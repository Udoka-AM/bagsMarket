/**
 * Development fixtures.
 *
 * Every row written here uses a deterministic id from the `5eed…` range, and
 * the script deletes exactly those ids before re-inserting. That is what makes
 * it safe to run against a database with real data in it: it cannot touch a row
 * it did not create, and running it twice leaves the same state as running it
 * once.
 *
 * Rows are attached to the first profile in the database — sign in once before
 * running this, so there is an identity to own them.
 *
 *   npm run db:seed
 */
import { asc, eq, inArray } from "drizzle-orm";
import { createDatabase } from "./index";
import { activity, alertEvents, alerts, claims, feeShares, jobs, launches, profiles } from "./schema";

// Fixed ids, so re-running replaces rather than accumulates. Children
// (fee_shares, alert_events) cascade from their parents and need no ids here.
const ID = {
  launch: [
    "5eed0000-0000-4000-8000-000000000101",
    "5eed0000-0000-4000-8000-000000000102",
    "5eed0000-0000-4000-8000-000000000103"
  ],
  claim: ["5eed0000-0000-4000-8000-000000000201", "5eed0000-0000-4000-8000-000000000202"],
  alert: ["5eed0000-0000-4000-8000-000000000301", "5eed0000-0000-4000-8000-000000000302"],
  activity: [
    "5eed0000-0000-4000-8000-000000000401",
    "5eed0000-0000-4000-8000-000000000402",
    "5eed0000-0000-4000-8000-000000000403",
    "5eed0000-0000-4000-8000-000000000404"
  ],
  job: [
    "5eed0000-0000-4000-8000-000000000501",
    "5eed0000-0000-4000-8000-000000000502",
    "5eed0000-0000-4000-8000-000000000503",
    "5eed0000-0000-4000-8000-000000000504",
    "5eed0000-0000-4000-8000-000000000505"
  ]
} as const;

const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000);
const hoursAgo = (n: number) => minutesAgo(n * 60);
const daysAgo = (n: number) => hoursAgo(n * 24);

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Source .env.local before running this.");
  }

  const db = createDatabase(connectionString);

  const [profile] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .orderBy(asc(profiles.createdAt))
    .limit(1);

  if (!profile) {
    throw new Error(
      "No profile found. Sign in with a wallet once — the profile is created on first " +
        "authenticated request — then run this again."
    );
  }

  console.log(`Seeding against profile ${profile.id}`);

  // Delete first, by id. Claims and fee_shares hang off launches and cascade,
  // as do alert_events off alerts.
  await db.delete(activity).where(inArray(activity.id, [...ID.activity]));
  await db.delete(claims).where(inArray(claims.id, [...ID.claim]));
  await db.delete(alerts).where(inArray(alerts.id, [...ID.alert]));
  await db.delete(launches).where(inArray(launches.id, [...ID.launch]));
  await db.delete(jobs).where(inArray(jobs.id, [...ID.job]));

  await db.insert(launches).values([
    {
      id: ID.launch[0],
      profileId: profile.id,
      name: "Sunrise Protocol",
      symbol: "SUNP",
      tokenMint: "So11111111111111111111111111111111111111112",
      bagsLaunchId: "seed-bags-0001",
      status: "live",
      launchedAt: daysAgo(6)
    },
    {
      id: ID.launch[1],
      profileId: profile.id,
      name: "Harbour Index",
      symbol: "HRBR",
      tokenMint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
      bagsLaunchId: "seed-bags-0002",
      status: "pending",
      launchedAt: null
    },
    {
      id: ID.launch[2],
      profileId: profile.id,
      name: "Nightshift",
      symbol: "NGHT",
      tokenMint: null,
      bagsLaunchId: null,
      status: "draft",
      launchedAt: null
    }
  ]);

  // Splits total 10000 basis points per launch — a cross-row invariant Postgres
  // cannot express as a CHECK, so getting it right here matters.
  await db.insert(feeShares).values([
    { launchId: ID.launch[0], recipientAddress: "3ZXsjE2JYSoPBG5WdtS6UWah8XgpDMLeBn6wpx6C2G5E", basisPoints: 6000 },
    { launchId: ID.launch[0], recipientAddress: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM", basisPoints: 3000 },
    { launchId: ID.launch[0], recipientAddress: "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9", basisPoints: 1000 },
    { launchId: ID.launch[1], recipientAddress: "3ZXsjE2JYSoPBG5WdtS6UWah8XgpDMLeBn6wpx6C2G5E", basisPoints: 10000 }
  ]);

  // Amounts are base units as strings. Parsing these into a JS number would
  // lose precision above 2^53 — see packages/db/README.md.
  await db.insert(claims).values([
    {
      id: ID.claim[0],
      launchId: ID.launch[0],
      profileId: profile.id,
      amount: "1250000000",
      tokenMint: "So11111111111111111111111111111111111111112",
      txSignature: "5seedTxSignatureConfirmed1111111111111111111111111111111111111111111111111111111111111",
      status: "confirmed",
      confirmedAt: daysAgo(2)
    },
    {
      id: ID.claim[1],
      launchId: ID.launch[0],
      profileId: profile.id,
      amount: "480000000",
      tokenMint: "So11111111111111111111111111111111111111112",
      txSignature: null,
      status: "pending",
      confirmedAt: null
    }
  ]);

  await db.insert(alerts).values([
    {
      id: ID.alert[0],
      profileId: profile.id,
      name: "SUNP liquidity drop",
      subjectType: "token",
      subjectRef: "So11111111111111111111111111111111111111112",
      rule: { metric: "liquidity_usd", op: "lt", value: 25000 },
      channel: "in_app",
      isActive: true,
      lastFiredAt: hoursAgo(5)
    },
    {
      id: ID.alert[1],
      profileId: profile.id,
      name: "Repo activity stalled",
      subjectType: "repository",
      subjectRef: "bags-fm/bags-sdk",
      rule: { metric: "commits_7d", op: "lt", value: 1 },
      channel: "email",
      isActive: false,
      mutedUntil: daysAgo(-3)
    }
  ]);

  await db.insert(alertEvents).values([
    {
      alertId: ID.alert[0],
      firedAt: hoursAgo(5),
      payload: { liquidity_usd: 18400, threshold: 25000 },
      deliveryStatus: "delivered",
      deliveredAt: hoursAgo(5),
      explanation: "Liquidity fell 38% in an hour after a large single-sided withdrawal."
    },
    {
      alertId: ID.alert[0],
      firedAt: daysAgo(3),
      payload: { liquidity_usd: 22100, threshold: 25000 },
      deliveryStatus: "failed",
      deliveredAt: null,
      explanation: null
    }
  ]);

  await db.insert(activity).values([
    { id: ID.activity[0], profileId: profile.id, kind: "launch.created", subjectType: "launch", subjectRef: ID.launch[0], occurredAt: daysAgo(6) },
    { id: ID.activity[1], profileId: profile.id, kind: "claim.confirmed", subjectType: "claim", subjectRef: ID.claim[0], occurredAt: daysAgo(2) },
    { id: ID.activity[2], profileId: profile.id, kind: "alert.fired", subjectType: "alert", subjectRef: ID.alert[0], occurredAt: hoursAgo(5) },
    { id: ID.activity[3], profileId: profile.id, kind: "launch.created", subjectType: "launch", subjectRef: ID.launch[1], occurredAt: hoursAgo(30) }
  ]);

  // System-owned: profile_id stays null, which is why `jobs` has no RLS policy.
  await db.insert(jobs).values([
    { id: ID.job[0], kind: "ingest.birdeye", status: "succeeded", attempts: 1, scheduledFor: hoursAgo(2), startedAt: hoursAgo(2), finishedAt: minutesAgo(119) },
    { id: ID.job[1], kind: "ingest.dexscreener", status: "running", attempts: 1, scheduledFor: minutesAgo(5), startedAt: minutesAgo(5) },
    { id: ID.job[2], kind: "evaluate.alerts", status: "queued", attempts: 0, scheduledFor: minutesAgo(-10) },
    { id: ID.job[3], kind: "ingest.github", status: "failed", attempts: 2, lastError: "GitHub API rate limit exceeded (403)", scheduledFor: hoursAgo(1), startedAt: hoursAgo(1), finishedAt: minutesAgo(58) },
    { id: ID.job[4], kind: "summarize.daily", status: "dead", attempts: 3, lastError: "OpenAI request timed out after 3 attempts", scheduledFor: daysAgo(1), startedAt: daysAgo(1), finishedAt: hoursAgo(23) }
  ]);

  const counts = {
    launches: (await db.select().from(launches).where(eq(launches.profileId, profile.id))).length,
    feeShares: (await db.select().from(feeShares)).length,
    claims: (await db.select().from(claims).where(eq(claims.profileId, profile.id))).length,
    alerts: (await db.select().from(alerts).where(eq(alerts.profileId, profile.id))).length,
    alertEvents: (await db.select().from(alertEvents)).length,
    activity: (await db.select().from(activity).where(eq(activity.profileId, profile.id))).length,
    jobs: (await db.select().from(jobs)).length
  };

  console.log("Seeded:", counts);
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
