import { Inject, Injectable, Logger } from "@nestjs/common";
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

  constructor(
    @Inject(REDIS) redis: Redis | null,
    @Inject(DATABASE) private readonly db: Database
  ) {
    this.queue = redis ? new Queue(QUEUE_NAME, { connection: redis }) : null;
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

  async close() {
    await this.queue?.close();
  }
}
