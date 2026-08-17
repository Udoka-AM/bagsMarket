import { Inject, Injectable } from "@nestjs/common";
import { desc, jobs, type Database } from "@bagsmarkets/db";
import type { Job } from "@bagsmarkets/types";
import { DATABASE } from "../database/database.module";

@Injectable()
export class JobsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /**
   * Most recent jobs first.
   *
   * No profile filter yet: `jobs` rows can be system-owned (`profile_id IS
   * NULL`) and there is no authenticated user until Phase 3. Once there is,
   * this must filter by profile — see the ownership decision in
   * docs/architecture.md. RLS does not cover it, because the API connects with
   * a privileged role.
   */
  async list(limit = 20): Promise<Job[]> {
    const rows = await this.db
      .select()
      .from(jobs)
      .orderBy(desc(jobs.createdAt))
      .limit(limit);

    // Mapped explicitly rather than returned raw: the row type and the wire
    // contract are allowed to diverge, and Date must become an ISO string.
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      status: row.status,
      attempts: row.attempts,
      maxAttempts: row.maxAttempts,
      lastError: row.lastError,
      scheduledFor: row.scheduledFor?.toISOString() ?? null,
      finishedAt: row.finishedAt?.toISOString() ?? null
    }));
  }
}
