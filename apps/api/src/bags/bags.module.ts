import { Global, Logger, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BagsFixtureAdapter } from "./bags-fixture.adapter";
import { BagsSdkAdapter } from "./bags-sdk.adapter";
import { BAGS, type BagsPort } from "./bags.port";

@Global()
@Module({
  providers: [
    {
      provide: BAGS,
      inject: [ConfigService],
      useFactory: (config: ConfigService): BagsPort => {
        const apiKey = config.get<string>("BAGS_API_KEY");
        const rpcUrl = config.get<string>("HELIUS_RPC_URL");
        const cluster = config.get<string>("NEXT_PUBLIC_SOLANA_CLUSTER");
        const logger = new Logger("BagsModule");

        // The UI advertises `cluster` while transactions execute against
        // `rpcUrl`. If those disagree, the app tells the user one network and
        // signs on another — which once funds move is an expensive way to find
        // out. Fail at startup rather than let it ship.
        if (rpcUrl && cluster) {
          const rpcIsMainnet = rpcUrl.includes("mainnet");
          const uiIsMainnet = cluster.startsWith("mainnet");

          if (rpcIsMainnet !== uiIsMainnet) {
            throw new Error(
              `Network mismatch: NEXT_PUBLIC_SOLANA_CLUSTER is "${cluster}" but ` +
                "HELIUS_RPC_URL points at " +
                `${rpcIsMainnet ? "mainnet" : "a non-mainnet cluster"}. ` +
                "Make them agree before running — a mismatch signs real transactions " +
                "on a network the UI is not showing."
            );
          }
        }

        // Both are required: the SDK takes the key as a constructor argument
        // and needs an RPC connection for the on-chain reads it does itself.
        if (apiKey && rpcUrl) {
          logger.log("BAGS_API_KEY and HELIUS_RPC_URL set — using the live Bags SDK.");
          return BagsSdkAdapter.create(apiKey, rpcUrl);
        }

        logger.warn(
          "BAGS_API_KEY or HELIUS_RPC_URL missing — serving fixture positions. " +
            "Responses are marked source: \"fixture\" and are not real data."
        );
        return new BagsFixtureAdapter();
      }
    }
  ],
  exports: [BAGS]
})
export class BagsModule {}
