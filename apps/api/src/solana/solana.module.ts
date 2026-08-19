import { Module } from "@nestjs/common";
import { BalancesController } from "./balances.controller";
import { SolanaService } from "./solana.service";

@Module({
  controllers: [BalancesController],
  providers: [SolanaService],
  exports: [SolanaService]
})
export class SolanaModule {}
