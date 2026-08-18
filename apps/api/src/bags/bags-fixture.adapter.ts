import { Injectable } from "@nestjs/common";
import type { ClaimablePosition } from "@bagsmarkets/types";
import type { BagsPort } from "./bags.port";

/**
 * Stands in for Bags when no API key is configured.
 *
 * The SDK takes the key as a required constructor argument, so without one the
 * real adapter cannot even be built. Rather than leave the feature dark, this
 * returns deterministic positions so the surrounding code — endpoint, mapping,
 * UI, tests — is exercised and reviewable before a key exists.
 *
 * It reports `source: "fixture"`, and every caller is expected to pass that
 * through so nothing presents invented numbers as real ones.
 */
@Injectable()
export class BagsFixtureAdapter implements BagsPort {
  readonly source = "fixture" as const;

  async listClaimablePositions(walletAddress: string): Promise<ClaimablePosition[]> {
    // Keyed off the wallet so two different wallets do not show identical
    // figures, which would make a filtering bug invisible.
    const seed = walletAddress.charCodeAt(0) % 3;

    return [
      {
        baseMint: "So11111111111111111111111111111111111111112",
        claimableLamports: String(1_250_000_000 + seed * 10_000_000),
        isMigrated: true,
        launchName: null
      },
      {
        baseMint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
        claimableLamports: String(48_000_000 + seed * 1_000_000),
        isMigrated: false,
        launchName: null
      }
    ];
  }
}
