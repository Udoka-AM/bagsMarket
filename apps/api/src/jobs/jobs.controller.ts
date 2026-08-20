import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from "@nestjs/common";
import type { Job, Paginated } from "@bagsmarkets/types";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/supabase-jwt.service";
import { JobsQueue } from "./jobs.queue";
import { JobsService } from "./jobs.service";

@Controller("jobs")
@UseGuards(AuthGuard)
export class JobsController {
  constructor(
    private readonly jobs: JobsService,
    private readonly queue: JobsQueue
  ) {}

  /**
   * Jobs visible to the caller: their own, plus system-owned work.
   *
   * System jobs (`profile_id IS NULL`) are shown because they are the ingestion
   * and maintenance runs everyone depends on — hiding them would make the
   * Workflows page look idle while the system is busy.
   */
  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query("limit") limit?: string
  ): Promise<Paginated<Job>> {
    const parsed = Number.parseInt(limit ?? "", 10);
    const take = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 100) : 20;

    const items = await this.jobs.listVisibleTo(user.id, take);

    return { items, nextCursor: null };
  }

  /** Queues a reconciliation pass over the caller's own pending claims. */
  @Post("reconcile-claims")
  @HttpCode(202)
  async reconcileClaims(@CurrentUser() user: AuthenticatedUser, @Body() _body: unknown) {
    const row = await this.jobs.toContract(
      await this.queue.enqueue("claims.reconcile", { profileId: user.id }, user.id)
    );

    return { job: row, queued: this.queue.enabled };
  }
}
