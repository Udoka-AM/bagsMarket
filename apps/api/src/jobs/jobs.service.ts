import { Inject, Injectable } from "@nestjs/common";
import { desc, eq, isNull, jobs, or, type Database } from "@bagsmarkets/db";
import type { Job } from "@bagsmarkets/types";
import { DATABASE } from "../database/database.module";

@Injectable()
export class JobsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /**
   * The caller's jobs plus system-owned ones, newest first.
   *
   * Deliberately not every job: another user's work is none of the caller's
   * business, and this endpoint previously had no auth at all.
   */
  async listVisibleTo(profileId: string, limit = 20): Promise<Job[]> {
    const rows = await this.db
      .select()
      .from(jobs)
      .where(or(eq(jobs.profileId, profileId), isNull(jobs.profileId)))
      .orderBy(desc(jobs.createdAt))
      .limit(limit);

    return rows.map((row) => this.toContract(row));
  }

  toContract(row: typeof jobs.$inferSelect): Job {
    return {
      id: row.id,
      kind: row.kind,
      status: row.status,
      attempts: row.attempts,
      maxAttempts: row.maxAttempts,
      lastError: row.lastError,
      scheduledFor: row.scheduledFor?.toISOString() ?? null,
      finishedAt: row.finishedAt?.toISOString() ?? null
    };
  }
}
