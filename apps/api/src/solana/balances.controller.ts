import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { asc, eq, wallets, type Database } from "@bagsmarkets/db";
import type { WalletBalance } from "@bagsmarkets/types";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/supabase-jwt.service";
import { DATABASE } from "../database/database.module";
import { SolanaService } from "./solana.service";

export type BalancesResponse = {
  items: WalletBalance[];
  /** False when HELIUS_RPC_URL is unset, so the UI can explain the blank. */
  rpcConfigured: boolean;
};

@Controller("balances")
@UseGuards(AuthGuard)
export class BalancesController {
  constructor(
    private readonly solana: SolanaService,
    @Inject(DATABASE) private readonly db: Database
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser): Promise<BalancesResponse> {
    // Addresses come from our own records, never from the request, so a caller
    // cannot read balances for a wallet they have not proven they own.
    const owned = await this.db
      .select()
      .from(wallets)
      .where(eq(wallets.profileId, user.id))
      .orderBy(asc(wallets.createdAt));

    const items = await Promise.all(
      owned.map(async (wallet) => ({
        address: wallet.address,
        lamports: await this.solana.getLamports(wallet.address)
      }))
    );

    return { items, rpcConfigured: this.solana.configured };
  }
}
