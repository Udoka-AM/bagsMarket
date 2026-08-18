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
        const logger = new Logger("BagsModule");

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
