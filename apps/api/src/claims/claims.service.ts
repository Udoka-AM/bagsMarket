import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, claims, eq, wallets, type Database } from "@bagsmarkets/db";
import type { Claim, ClaimDraft } from "@bagsmarkets/types";
import { BAGS, type BagsPort } from "../bags/bags.port";
import { DATABASE } from "../database/database.module";

/** Base58, 32-44 characters. Enough to reject junk before it reaches an RPC. */
const MINT_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

@Injectable()
export class ClaimsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(BAGS) private readonly bags: BagsPort
  ) {}

  /**
   * Starts a claim: records it as pending and returns transactions to sign.
   *
   * The row is written *before* the transactions go out, so a claim the user
   * abandons still leaves a trace. The alternative — record on success — loses
   * every attempt that failed partway, which is exactly the case worth seeing.
   */
  async start(profileId: string, tokenMint: string): Promise<ClaimDraft> {
    if (!MINT_PATTERN.test(tokenMint)) {
      throw new BadRequestException("tokenMint is not a valid Solana address");
    }

    const [wallet] = await this.db
      .select()
      .from(wallets)
      .where(eq(wallets.profileId, profileId))
      .orderBy(asc(wallets.createdAt))
      .limit(1);

    if (!wallet) {
      throw new BadRequestException("No wallet on file to claim to");
    }

    // Refusing a second pending claim for the same mint keeps a double-click
    // from producing two rows racing to record the same signature.
    const [existing] = await this.db
      .select()
      .from(claims)
      .where(
        and(
          eq(claims.profileId, profileId),
          eq(claims.tokenMint, tokenMint),
          eq(claims.status, "pending")
        )
      )
      .limit(1);

    if (existing) {
      throw new ConflictException(
        "A claim for this token is already pending. Finish or abandon it first."
      );
    }

    const transactions = await this.bags.buildClaimTransactions(wallet.address, tokenMint);

    if (transactions.length === 0) {
      throw new BadRequestException("Nothing claimable for this token");
    }

    const [row] = await this.db
      .insert(claims)
      .values({
        profileId,
        // The launch this belongs to is not known until we index mints back to
        // launches; the claim stands on its own until then.
        launchId: null,
        tokenMint,
        // Filled in on confirmation, when the actual transferred amount is known.
        amount: "0",
        status: "pending"
      })
      .returning();

    return { claimId: row.id, transactions };
  }

  /**
   * Records the signature the wallet produced.
   *
   * `claims.tx_signature` is unique, so replaying the same signature — a
   * double-submit, a retried request — is rejected by the database rather than
   * quietly creating a second record of one on-chain event.
   */
  async recordSignature(profileId: string, claimId: string, signature: string): Promise<Claim> {
    if (!MINT_PATTERN.test(signature) && signature.length < 64) {
      throw new BadRequestException("signature does not look like a transaction signature");
    }

    const [claim] = await this.db
      .select()
      .from(claims)
      // Scoped to the caller: a claim id alone must not be enough to write to
      // someone else's row.
      .where(and(eq(claims.id, claimId), eq(claims.profileId, profileId)))
      .limit(1);

    if (!claim) {
      throw new NotFoundException("Claim not found");
    }

    if (claim.txSignature) {
      throw new ConflictException("This claim already has a signature recorded");
    }

    const [updated] = await this.db
      .update(claims)
      .set({ txSignature: signature })
      .where(eq(claims.id, claimId))
      .returning();

    return this.toContract(updated);
  }

  async listForProfile(profileId: string, limit = 20): Promise<Claim[]> {
    const rows = await this.db
      .select()
      .from(claims)
      .where(eq(claims.profileId, profileId))
      .limit(limit);

    return rows.map((row) => this.toContract(row));
  }

  private toContract(row: typeof claims.$inferSelect): Claim {
    return {
      id: row.id,
      launchId: row.launchId ?? "",
      amount: row.amount,
      tokenMint: row.tokenMint,
      txSignature: row.txSignature,
      status: row.status,
      confirmedAt: row.confirmedAt?.toISOString() ?? null
    };
  }
}
