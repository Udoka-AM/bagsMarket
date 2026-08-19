import type { ClaimablePosition } from "@bagsmarkets/types";

export const BAGS = Symbol("BAGS");

/**
 * What the rest of the API needs from Bags.
 *
 * An interface rather than the SDK directly, for two reasons: the SDK requires
 * an API key at construction, so without one there would be nothing to inject
 * at all; and its return types are Meteora pool unions that should not spread
 * through our services.
 */
export interface BagsPort {
  /** Fee positions the given wallet can claim from. */
  listClaimablePositions(walletAddress: string): Promise<ClaimablePosition[]>;

  /**
   * Unsigned transactions that would claim this wallet's fees for one mint,
   * base64-encoded.
   *
   * The API never signs and never broadcasts: it hands transactions to the
   * browser, the user's wallet signs and sends them, and the resulting
   * signature comes back to be recorded. Private keys stay in the wallet.
   */
  buildClaimTransactions(walletAddress: string, tokenMint: string): Promise<string[]>;

  /** Which implementation answered — surfaced so the UI never implies fixtures are real. */
  readonly source: "bags" | "fixture";
}
