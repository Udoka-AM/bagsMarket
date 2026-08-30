import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import type { Signal, WatchlistItem } from "@bagsmarkets/types";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/supabase-jwt.service";
import { JobsQueue } from "../jobs/jobs.queue";
import { SignalsService } from "./signals.service";

type AddWatchBody = { ref?: unknown; label?: unknown };

@Controller()
@UseGuards(AuthGuard)
export class SignalsController {
  constructor(
    private readonly signals: SignalsService,
    private readonly queue: JobsQueue
  ) {}

  @Get("signals")
  async list(@CurrentUser() user: AuthenticatedUser): Promise<{ items: Signal[] }> {
    return { items: await this.signals.listSignals(user.id) };
  }

  @Get("watchlist")
  async watchlist(@CurrentUser() user: AuthenticatedUser): Promise<{ items: WatchlistItem[] }> {
    return { items: await this.signals.listWatchlist(user.id) };
  }

  @Post("watchlist")
  @HttpCode(201)
  async add(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AddWatchBody
  ): Promise<WatchlistItem> {
    const ref = typeof body?.ref === "string" ? body.ref : "";
    const label = typeof body?.label === "string" ? body.label : undefined;

    const item = await this.signals.addToWatchlist(user.id, ref, label);

    // Queued so the new entry is not blank until the next scheduled run, which
    // could be half an hour away. Best-effort: the entry exists either way.
    await this.queue.enqueue("signals.ingest-github", {}, undefined);

    return item;
  }

  @Delete("watchlist/:id")
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string
  ): Promise<void> {
    await this.signals.removeFromWatchlist(user.id, id);
  }
}
