import { Inject, Injectable, Logger } from "@nestjs/common";
import { Connection } from "@solana/web3.js";
import { and, claims, eq, isNotNull, type Database } from "@bagsmarkets/db";
import { ConfigService } from "@nestjs/config";
import { DATABASE } from "../../database/database.module";
import type { JobPayloads } from "../job-kinds";

@Injectable()
export class ReconcileClaimsHandler {
  private readonly logger = new Logger(ReconcileClaimsHandler.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly config: ConfigService
  ) {}

  /**
   * Settles claims that have a signature but no outcome.
   *
   * A claim is created `pending`, the wallet broadcasts, and the signature is
   * recorded — but nothing has ever checked what happened on-chain, so claims
   * stayed pending forever. This closes that.
   *
   * Claims without a signature are left alone: they were started and abandoned,
   * which is a real state rather than an error, and there is nothing to look up.
   */
  async run(payload: JobPayloads["claims.reconcile"]): Promise<{ checked: number; settled: number }> {
    const rpcUrl = this.config.get<string>("HELIUS_RPC_URL");

    if (!rpcUrl) {
      // Thrown rather than returned: the job should retry once the RPC is
      // configured, not record a success that settled nothing.
      throw new Error("HELIUS_RPC_URL is not set; cannot reconcile claims");
    }

    const where = payload.profileId
      ? and(
          eq(claims.status, "pending"),
          isNotNull(claims.txSignature),
          eq(claims.profileId, payload.profileId)
        )
      : and(eq(claims.status, "pending"), isNotNull(claims.txSignature));

    const pending = await this.db.select().from(claims).where(where);

    if (pending.length === 0) {
      return { checked: 0, settled: 0 };
    }

    const connection = new Connection(rpcUrl, "confirmed");
    const signatures = pending.map((claim) => claim.txSignature!);

    // One batched RPC call rather than one per claim: the endpoint is billed
    // per request and accepts up to 256 signatures.
    const statuses = await connection.getSignatureStatuses(signatures, {
      searchTransactionHistory: true
    });

    let settled = 0;

    for (const [index, claim] of pending.entries()) {
      const status = statuses.value[index];

      // Null means the RPC has not seen it — too recent, or dropped. Left
      // pending so a later run can decide, rather than guessing now.
      if (!status) {
        continue;
      }

      const failed = status.err !== null;

      await this.db
        .update(claims)
        .set({
          status: failed ? "failed" : "confirmed",
          confirmedAt: failed ? null : new Date()
        })
        .where(eq(claims.id, claim.id));

      settled += 1;
    }

    this.logger.log(`Reconciled ${settled} of ${pending.length} pending claims`);

    return { checked: pending.length, settled };
  }
}
