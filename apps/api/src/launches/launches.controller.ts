import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import type { Launch, Paginated } from "@bagsmarkets/types";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/supabase-jwt.service";
import { LaunchesService } from "./launches.service";

@Controller("launches")
@UseGuards(AuthGuard)
export class LaunchesController {
  constructor(private readonly launches: LaunchesService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query("limit") limit?: string
  ): Promise<Paginated<Launch>> {
    const parsed = Number.parseInt(limit ?? "", 10);
    const take = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 100) : 20;

    // Scoped to the caller — never to a profile id from the query string.
    const items = await this.launches.listForProfile(user.id, take);

    return { items, nextCursor: null };
  }
}
