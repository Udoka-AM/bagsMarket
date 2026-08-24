import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit
} from "@nestjs/common";
import { Worker, type Job } from "bullmq";
import type { Redis } from "ioredis";
import { eq, jobs, type Database } from "@bagsmarkets/db";
import { DATABASE } from "../database/database.module";
import { ReconcileClaimsHandler } from "./handlers/reconcile-claims.handler";
import { JobsQueue } from "./jobs.queue";
import { QUEUE_NAME, type JobKind } from "./job-kinds";
import { REDIS } from "./redis.module";

@Injectable()
export class JobsWorker implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(JobsWorker.name);
  private worker: Worker | null = null;

  constructor(
    @Inject(REDIS) private readonly redis: Redis | null,
    @Inject(DATABASE) private readonly db: Database,
    private readonly reconcileClaims: ReconcileClaimsHandler,
    private readonly queue: JobsQueue
  ) {}

  /**
   * Runs in the API process for now.
   *
   * A separate `apps/worker` is the right shape — architecture.md says so — and
   * matters as soon as a job is slow enough to compete with request handling,
   * or the two need scaling independently. In-process is honest for one reader
   * and one queue, and the seam is the handler map: moving out means a new
   * entrypoint, not a rewrite.
   */
  onModuleInit() {
    if (!this.redis) {
      this.logger.warn("Redis not configured — no jobs will be processed.");
      return;
    }

    this.worker = new Worker(
      QUEUE_NAME,
      async (job) => this.process(job),
      { connection: this.redis, concurrency: 2 }
    );

    this.worker.on("failed", (job, error) => {
      void this.recordFailure(job, error);
    });

    // Registered after the worker exists, so the first scheduled run has
    // something to process rather than sitting in the queue.
    void this.queue.registerSchedules();

    this.logger.log("Job worker started");
  }

  private async createRowFor(kind: JobKind): Promise<string> {
    const [row] = await this.db
      .insert(jobs)
      .values({
        kind,
        profileId: null,
        status: "running",
        maxAttempts: 3,
        scheduledFor: new Date()
      })
      .returning();

    return row.id;
  }

  private handlerFor(kind: JobKind) {
    switch (kind) {
      case "claims.reconcile":
        return (payload: Record<string, unknown>) =>
          this.reconcileClaims.run(payload as { profileId?: string });
      default:
        // Exhaustive: adding a JobKind without a handler fails the build here
        // rather than dying in the worker at 3am.
        return null;
    }
  }

  private async process(job: Job) {
    const { jobRowId: existingRowId, ...payload } = job.data as {
      jobRowId?: string;
    } & Record<string, unknown>;
    const kind = job.name as JobKind;

    // Scheduler-originated runs arrive without a row, because nothing called
    // enqueue() for them. Creating it here keeps every run visible on the
    // Workflows page rather than only the ones a user triggered.
    const jobRowId = existingRowId ?? (await this.createRowFor(kind));

    await this.db
      .update(jobs)
      .set({
        status: "running",
        // BullMQ counts from 1 on the first run; the row mirrors that.
        attempts: job.attemptsMade + 1,
        startedAt: new Date()
      })
      .where(eq(jobs.id, jobRowId));

    const handler = this.handlerFor(kind);

    if (!handler) {
      throw new Error(`No handler registered for job kind "${kind}"`);
    }

    const result = await handler(payload);

    await this.db
      .update(jobs)
      .set({ status: "succeeded", finishedAt: new Date(), lastError: null })
      .where(eq(jobs.id, jobRowId));

    return result;
  }

  /**
   * Mirrors a failure onto the durable row.
   *
   * `failed` means it will be retried; `dead` means the attempt budget is spent
   * and nothing else will happen without a person. Distinguishing them is the
   * whole point of a dead-letter state — a queue that only says "failed" cannot
   * tell you what still needs a human.
   */
  private async recordFailure(job: Job | undefined, error: Error) {
    if (!job) {
      this.logger.error(`Job failed with no job reference: ${error.message}`);
      return;
    }

    const { jobRowId } = job.data as { jobRowId?: string };

    if (!jobRowId) {
      return;
    }

    const exhausted = job.attemptsMade >= (job.opts.attempts ?? 1);

    await this.db
      .update(jobs)
      .set({
        status: exhausted ? "dead" : "failed",
        attempts: job.attemptsMade,
        lastError: error.message.slice(0, 1000),
        finishedAt: exhausted ? new Date() : null
      })
      .where(eq(jobs.id, jobRowId));

    this.logger[exhausted ? "error" : "warn"](
      `Job ${job.name} ${exhausted ? "dead" : "failed"} (attempt ${job.attemptsMade}): ${error.message}`
    );
  }

  async onApplicationShutdown() {
    // Closed before the Redis connection so in-flight jobs finish their writes.
    await this.worker?.close();
  }
}
