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

  /** Which implementation answered — surfaced so the UI never implies fixtures are real. */
  readonly source: "bags" | "fixture";
}
