import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import type { Redis } from "ioredis";
import { jobs, type Database } from "@bagsmarkets/db";
import { DATABASE } from "../database/database.module";
import { QUEUE_NAME, type JobKind, type JobPayloads } from "./job-kinds";
import { REDIS } from "./redis.module";

/** Attempts before a job is considered dead. Mirrored onto the durable row. */
const MAX_ATTEMPTS = 3;

@Injectable()
export class JobsQueue {
  private readonly logger = new Logger(JobsQueue.name);
  private readonly queue: Queue | null;

  private readonly everyMinutes: number;
  private readonly ingestEveryMinutes: number;

  constructor(
    @Inject(REDIS) redis: Redis | null,
    @Inject(DATABASE) private readonly db: Database,
    config: ConfigService
  ) {
    this.queue = redis ? new Queue(QUEUE_NAME, { connection: redis }) : null;
    // Configurable so a deployment can slow it down; five minutes is a
    // compromise between settling promptly and not hammering the RPC.
    this.everyMinutes = Number(config.get("RECONCILE_EVERY_MINUTES") ?? 5);
    this.ingestEveryMinutes = Number(config.get("INGEST_EVERY_MINUTES") ?? 30);
  }

  get enabled() {
    return this.queue !== null;
  }

  /**
   * Enqueues work and records it durably.
   *
   * Two stores, on purpose. BullMQ owns scheduling, retries and backoff in
   * Redis, which is fast and disposable. The `jobs` table is the record that
   * survives a Redis flush and is what the Workflows page reads — Redis is a
   * queue, not a history.
   *
   * The row is written first: a job that runs before its record exists would
   * have nothing to update, whereas a row with no queue entry is merely a job
   * that never started, which is visible and recoverable.
   */
  async enqueue<K extends JobKind>(kind: K, payload: JobPayloads[K], profileId?: string) {
    const [row] = await this.db
      .insert(jobs)
      .values({
        kind,
        profileId: profileId ?? null,
        payload,
        status: "queued",
        maxAttempts: MAX_ATTEMPTS,
        scheduledFor: new Date()
      })
      .returning();

    if (!this.queue) {
      this.logger.warn(`Queued ${kind} to the database only — Redis is not configured.`);
      return row;
    }

    await this.queue.add(
      kind,
      // The row id travels with the job so the worker updates the same record
      // rather than trying to match on kind and timestamp.
      { jobRowId: row.id, ...payload },
      {
        attempts: MAX_ATTEMPTS,
        backoff: { type: "exponential", delay: 2_000 },
        // Keep a little history in Redis for debugging, but not indefinitely —
        // the durable record is in Postgres.
        removeOnComplete: 100,
        removeOnFail: 500
      }
    );

    return row;
  }

  /**
   * Registers the recurring work.
   *
   * `upsertJobScheduler` is idempotent on the scheduler id, so every API
   * instance calling this on boot converges on one schedule rather than N.
   *
   * Reconciliation has to be on a timer: a claim records its signature and then
   * nothing looks at the chain again. Without this, claims sit `pending`
   * forever and the user never learns whether their fees arrived.
   */
  async registerSchedules() {
    if (!this.queue) {
      return;
    }

    const everyMs = Number(this.everyMinutes) * 60_000;

    await this.queue.upsertJobScheduler(
      "claims.reconcile.recurring",
      { every: everyMs },
      {
        name: "claims.reconcile",
        // No jobRowId and no profileId: the worker creates the durable row for
        // scheduler-originated runs, and a system-wide pass covers every user.
        data: {}
      }
    );

    // Slower than reconciliation: repository metrics move over days, and every
    // extra run spends GitHub rate limit for a number that has not changed.
    await this.queue.upsertJobScheduler(
      "signals.ingest-github.recurring",
      { every: Number(this.ingestEveryMinutes) * 60_000 },
      { name: "signals.ingest-github", data: {} }
    );

    this.logger.log(
      `Scheduled claims.reconcile every ${this.everyMinutes} minutes, ` +
        `signals.ingest-github every ${this.ingestEveryMinutes} minutes`
    );
  }

  async close() {
    await this.queue?.close();
  }
}
