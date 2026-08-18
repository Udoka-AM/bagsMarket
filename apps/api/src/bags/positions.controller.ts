import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { asc, eq, wallets, type Database } from "@bagsmarkets/db";
import type { ClaimablePosition } from "@bagsmarkets/types";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/supabase-jwt.service";
import { DATABASE } from "../database/database.module";
import { BAGS, type BagsPort } from "./bags.port";

export type PositionsResponse = {
  items: ClaimablePosition[];
  /** "fixture" means these numbers are invented; the UI must say so. */
  source: "bags" | "fixture";
  /** Null when the caller has no wallet on file, so nothing could be queried. */
  wallet: string | null;
};

@Controller("positions")
@UseGuards(AuthGuard)
export class PositionsController {
  constructor(
    @Inject(BAGS) private readonly bags: BagsPort,
    @Inject(DATABASE) private readonly db: Database
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser): Promise<PositionsResponse> {
    // The wallet is read from our own records rather than the token, so a
    // caller cannot ask for positions belonging to an address they have not
    // proven ownership of.
    const [wallet] = await this.db
      .select()
      .from(wallets)
      .where(eq(wallets.profileId, user.id))
      .orderBy(asc(wallets.createdAt))
      .limit(1);

    if (!wallet) {
      return { items: [], source: this.bags.source, wallet: null };
    }

    const items = await this.bags.listClaimablePositions(wallet.address);

    return { items, source: this.bags.source, wallet: wallet.address };
  }
}
