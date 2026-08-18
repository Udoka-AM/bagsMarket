import { Inject, Injectable } from "@nestjs/common";
import { desc, eq, launches, type Database } from "@bagsmarkets/db";
import type { Launch } from "@bagsmarkets/types";
import { DATABASE } from "../database/database.module";

@Injectable()
export class LaunchesService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /**
   * Launches owned by one profile, newest first.
   *
   * The `profileId` predicate is the control that matters. RLS does not apply
   * here — the API connects with a privileged role that bypasses every policy —
   * so omitting this would return every user's launches to everyone. See the
   * ownership decision in docs/architecture.md.
   */
  async listForProfile(profileId: string, limit = 20): Promise<Launch[]> {
    const rows = await this.db
      .select()
      .from(launches)
      .where(eq(launches.profileId, profileId))
      .orderBy(desc(launches.createdAt))
      .limit(limit);

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      symbol: row.symbol,
      tokenMint: row.tokenMint,
      status: row.status,
      launchedAt: row.launchedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString()
    }));
  }
}
