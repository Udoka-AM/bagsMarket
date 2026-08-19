import { Injectable, Logger } from "@nestjs/common";
import { Connection, PublicKey } from "@solana/web3.js";
import { BagsSDK } from "@bagsfm/bags-sdk";
import type { ClaimablePosition } from "@bagsmarkets/types";
import type { BagsPort } from "./bags.port";

/**
 * The real Bags integration.
 *
 * NOT YET EXERCISED AGAINST THE LIVE API — no key has been available. The types
 * come from the SDK so the mapping is checked by the compiler, but the runtime
 * behaviour is unverified. Treat the first run with a real key as the test.
 */
@Injectable()
export class BagsSdkAdapter implements BagsPort {
  private readonly logger = new Logger(BagsSdkAdapter.name);
  readonly source = "bags" as const;

  constructor(private readonly sdk: BagsSDK) {}

  static create(apiKey: string, rpcUrl: string): BagsSdkAdapter {
    return new BagsSdkAdapter(new BagsSDK(apiKey, new Connection(rpcUrl, "confirmed")));
  }

  async buildClaimTransactions(walletAddress: string, tokenMint: string): Promise<string[]> {
    const transactions = await this.sdk.fee.getClaimTransactions(
      new PublicKey(walletAddress),
      new PublicKey(tokenMint)
    );

    // Serialised unsigned: the wallet supplies the signatures, so requiring
    // them here would reject every transaction before it ever reaches one.
    return transactions.map((transaction) =>
      transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString("base64")
    );
  }

  async listClaimablePositions(walletAddress: string): Promise<ClaimablePosition[]> {
    const positions = await this.sdk.fee.getAllClaimablePositions(new PublicKey(walletAddress));

    return positions.map((position) => ({
      baseMint: position.baseMint,
      // The SDK types lamports as a JS number, but u64 exceeds
      // Number.MAX_SAFE_INTEGER. Anything above ~9.007e15 has already lost
      // precision before it reaches us — converting through BigInt at least
      // stops us compounding it, and keeps the wire contract a string.
      claimableLamports: BigInt(Math.trunc(position.totalClaimableLamportsUserShare)).toString(),
      isMigrated: position.isMigrated,
      launchName: null
    }));
  }
}
