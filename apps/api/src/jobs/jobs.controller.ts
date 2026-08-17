import { Controller, Get, Query } from "@nestjs/common";
import type { Job, Paginated } from "@bagsmarkets/types";
import { JobsService } from "./jobs.service";

@Controller("jobs")
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  async list(@Query("limit") limit?: string): Promise<Paginated<Job>> {
    // Clamped so a bad query string cannot ask for the whole table.
    const parsed = Number.parseInt(limit ?? "", 10);
    const take = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 100) : 20;

    const items = await this.jobs.list(take);

    // Cursor paging is not implemented yet; the envelope shape is already the
    // contract so adding it later is not a breaking change.
    return { items, nextCursor: null };
  }
}
