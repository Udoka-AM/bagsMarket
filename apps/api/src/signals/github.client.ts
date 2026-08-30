import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { RepositoryMetrics } from "@bagsmarkets/types";

const API = "https://api.github.com";

/** Only slugs — anything else is a caller mistake, not a URL to follow. */
const SLUG_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

@Injectable()
export class GithubClient {
  private readonly logger = new Logger(GithubClient.name);
  private readonly token: string | undefined;

  constructor(config: ConfigService) {
    this.token = config.get<string>("GITHUB_TOKEN") || undefined;

    if (!this.token) {
      // Works without one, but at 60 requests/hour instead of 5000 — enough to
      // stop being useful the moment more than a couple of repos are watched.
      this.logger.warn("GITHUB_TOKEN is not set — using the unauthenticated rate limit.");
    }
  }

  static isValidSlug(ref: string) {
    return SLUG_PATTERN.test(ref);
  }

  private headers() {
    return {
      accept: "application/vnd.github+json",
      "user-agent": "bagsmarkets",
      ...(this.token ? { authorization: `Bearer ${this.token}` } : {})
    };
  }

  /**
   * Repository metrics, or null if the repo cannot be read.
   *
   * Null rather than throwing: one dead or renamed repository should not fail
   * the whole ingestion run and take every other repo's refresh with it.
   */
  async fetchRepository(slug: string): Promise<RepositoryMetrics | null> {
    if (!GithubClient.isValidSlug(slug)) {
      this.logger.warn(`Skipping "${slug}" — not an owner/repo slug`);
      return null;
    }

    try {
      // redirect: "follow" matters — renamed repositories answer 301, and a
      // watchlist accumulates those over time.
      const repoResponse = await fetch(`${API}/repos/${slug}`, {
        headers: this.headers(),
        redirect: "follow"
      });

      if (!repoResponse.ok) {
        this.logger.warn(`GitHub returned ${repoResponse.status} for ${slug}`);
        return null;
      }

      const repo = (await repoResponse.json()) as {
        stargazers_count?: number;
        forks_count?: number;
        open_issues_count?: number;
        pushed_at?: string;
        archived?: boolean;
        language?: string | null;
      };

      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const commitsResponse = await fetch(
        `${API}/repos/${slug}/commits?since=${since}&per_page=100`,
        { headers: this.headers(), redirect: "follow" }
      );

      // per_page caps at 100, so a very busy repo reports 100 rather than its
      // true count. Good enough for "is this alive"; a precise number would
      // need pagination this does not justify.
      const commits = commitsResponse.ok ? ((await commitsResponse.json()) as unknown[]) : [];

      return {
        stars: repo.stargazers_count ?? 0,
        forks: repo.forks_count ?? 0,
        openIssues: repo.open_issues_count ?? 0,
        commits7d: Array.isArray(commits) ? commits.length : 0,
        pushedAt: repo.pushed_at ?? null,
        archived: repo.archived ?? false,
        language: repo.language ?? null
      };
    } catch (cause) {
      this.logger.error(`GitHub fetch failed for ${slug}: ${(cause as Error).message}`);
      return null;
    }
  }
}
