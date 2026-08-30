import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, inArray, signalSnapshots, watchlistItems, type Database } from "@bagsmarkets/db";
import type { RepositoryMetrics, Signal, WatchlistItem } from "@bagsmarkets/types";
import { DATABASE } from "../database/database.module";
import { GithubClient } from "./github.client";

@Injectable()
export class SignalsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async listWatchlist(profileId: string): Promise<WatchlistItem[]> {
    const rows = await this.db
      .select()
      .from(watchlistItems)
      .where(eq(watchlistItems.profileId, profileId))
      .orderBy(desc(watchlistItems.createdAt));

    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      ref: row.ref,
      label: row.label,
      createdAt: row.createdAt.toISOString()
    }));
  }

  async addToWatchlist(profileId: string, ref: string, label?: string): Promise<WatchlistItem> {
    const trimmed = ref.trim();

    // Only repositories for now. Tokens arrive with the market feeds, and
    // accepting them before anything ingests them would add rows that never
    // produce a signal.
    if (!GithubClient.isValidSlug(trimmed)) {
      throw new BadRequestException(
        'Expected a GitHub repository as "owner/repo", for example "anza-xyz/agave"'
      );
    }

    const [existing] = await this.db
      .select()
      .from(watchlistItems)
      .where(
        and(
          eq(watchlistItems.profileId, profileId),
          eq(watchlistItems.kind, "repository"),
          eq(watchlistItems.ref, trimmed)
        )
      )
      .limit(1);

    if (existing) {
      throw new ConflictException("You are already watching this repository");
    }

    const [row] = await this.db
      .insert(watchlistItems)
      .values({ profileId, kind: "repository", ref: trimmed, label: label?.trim() || null })
      .returning();

    return {
      id: row.id,
      kind: row.kind,
      ref: row.ref,
      label: row.label,
      createdAt: row.createdAt.toISOString()
    };
  }

  async removeFromWatchlist(profileId: string, id: string): Promise<void> {
    // Scoped to the caller: an id alone must not be enough to delete someone
    // else's entry.
    const deleted = await this.db
      .delete(watchlistItems)
      .where(and(eq(watchlistItems.id, id), eq(watchlistItems.profileId, profileId)))
      .returning();

    if (deleted.length === 0) {
      throw new NotFoundException("Watchlist item not found");
    }
  }

  /**
   * The caller's watchlist, each entry carrying its most recent snapshot.
   *
   * Snapshots are shared and unscoped, so the join is done here against the
   * caller's own refs — a user never sees a signal for something they do not
   * follow, even though the underlying rows have no owner.
   */
  async listSignals(profileId: string): Promise<Signal[]> {
    const watched = await this.listWatchlist(profileId);

    if (watched.length === 0) {
      return [];
    }

    const refs = watched.map((item) => item.ref);

    // One query for every relevant snapshot, newest first, then reduced in
    // memory — cheaper than a correlated "latest per ref" subquery at this size.
    const snapshots = await this.db
      .select()
      .from(signalSnapshots)
      .where(and(eq(signalSnapshots.kind, "repository"), inArray(signalSnapshots.ref, refs)))
      .orderBy(desc(signalSnapshots.capturedAt));

    const latest = new Map<string, (typeof snapshots)[number]>();
    for (const snapshot of snapshots) {
      if (!latest.has(snapshot.ref)) {
        latest.set(snapshot.ref, snapshot);
      }
    }

    return watched.map((item) => {
      const snapshot = latest.get(item.ref);

      return {
        kind: item.kind,
        ref: item.ref,
        label: item.label,
        source: snapshot?.source ?? null,
        // Null when nothing has been captured yet — a freshly added repo has no
        // data, which is not the same as a repo with no activity.
        metrics: (snapshot?.metrics as RepositoryMetrics | undefined) ?? null,
        capturedAt: snapshot?.capturedAt.toISOString() ?? null
      };
    });
  }
}
