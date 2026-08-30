import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq, signalSnapshots, watchlistItems, type Database } from "@bagsmarkets/db";
import { DATABASE } from "../../database/database.module";
import { GithubClient } from "../github.client";

@Injectable()
export class IngestGithubHandler {
  private readonly logger = new Logger(IngestGithubHandler.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly github: GithubClient
  ) {}

  /**
   * Captures a snapshot for every repository anyone is watching.
   *
   * Fetches per *distinct* repo, not per watchlist entry: a repository's star
   * count is the same fact for every follower, so ten people watching the same
   * repo is still one API call. That is also why `signal_snapshots` carries no
   * profile_id.
   */
  async run(): Promise<{ repositories: number; captured: number }> {
    const watched = await this.db
      .selectDistinct({ ref: watchlistItems.ref })
      .from(watchlistItems)
      .where(eq(watchlistItems.kind, "repository"));

    if (watched.length === 0) {
      return { repositories: 0, captured: 0 };
    }

    let captured = 0;

    // Sequential on purpose. GitHub's rate limit is per token, and a burst of
    // parallel requests buys nothing but a closer brush with it.
    for (const { ref } of watched) {
      const metrics = await this.github.fetchRepository(ref);

      // A repo that could not be read is skipped rather than snapshotted as
      // zeros, which would look like a project that died overnight.
      if (!metrics) {
        continue;
      }

      await this.db.insert(signalSnapshots).values({
        kind: "repository",
        ref,
        source: "github",
        metrics
      });

      captured += 1;
    }

    this.logger.log(`Captured ${captured} of ${watched.length} watched repositories`);

    return { repositories: watched.length, captured };
  }
}
