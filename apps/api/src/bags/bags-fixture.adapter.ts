import { Injectable } from "@nestjs/common";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
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

  async buildClaimTransactions(walletAddress: string, _tokenMint: string): Promise<string[]> {
    // A structurally real transaction — a zero-lamport self-transfer — rather
    // than a random string, so serialisation and the browser's deserialisation
    // are genuinely exercised. It is never broadcast; the claim button is only
    // reachable when the live adapter is in use.
    const wallet = new PublicKey(walletAddress);
    const transaction = new Transaction().add(
      SystemProgram.transfer({ fromPubkey: wallet, toPubkey: wallet, lamports: 0 })
    );

    transaction.feePayer = wallet;
    // A fixed blockhash: fixtures must not vary run to run.
    transaction.recentBlockhash = "11111111111111111111111111111111";

    return [
      transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString("base64")
    ];
  }

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
