import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

type CacheEntry = { lamports: string; fetchedAt: number };

/** How long a balance is reused before hitting the RPC again. */
const CACHE_TTL_MS = 15_000;

@Injectable()
export class SolanaService {
  private readonly logger = new Logger(SolanaService.name);
  private readonly connection: Connection | null;

  /**
   * In-memory rather than Redis, deliberately.
   *
   * The dashboard is force-dynamic, so every page load would otherwise hit the
   * RPC — and Helius bills per request. A 15-second cache removes almost all of
   * that for one reader at no cost in dependencies or new failure modes.
   *
   * The limitation is real and worth stating: it is per-process and lost on
   * restart, so it stops helping the moment the API runs more than one
   * instance. That is when this should become Redis, which is already in
   * docker-compose for the purpose.
   */
  private readonly cache = new Map<string, CacheEntry>();

  constructor(config: ConfigService) {
    const rpcUrl = config.get<string>("HELIUS_RPC_URL");

    if (!rpcUrl) {
      // Balances are unavailable rather than fatal: the rest of the API works
      // without an RPC, and the endpoint reports the reason.
      this.logger.warn("HELIUS_RPC_URL is not set — wallet balances are unavailable.");
      this.connection = null;
      return;
    }

    this.connection = new Connection(rpcUrl, "confirmed");
  }

  get configured() {
    return this.connection !== null;
  }

  /**
   * SOL balance in lamports, as a string.
   *
   * getBalance returns a JS number; lamports are u64 and can exceed
   * Number.MAX_SAFE_INTEGER, so it is converted immediately and never travels
   * as a number. In practice no wallet holds enough SOL to overflow, but the
   * same discipline applies to token amounts where it very much can.
   */
  async getLamports(address: string): Promise<string | null> {
    if (!this.connection) {
      return null;
    }

    const cached = this.cache.get(address);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.lamports;
    }

    try {
      const balance = await this.connection.getBalance(new PublicKey(address));
      const lamports = BigInt(balance).toString();

      this.cache.set(address, { lamports, fetchedAt: Date.now() });

      return lamports;
    } catch (cause) {
      // An RPC outage should not take the dashboard down; the caller renders
      // the balance as unavailable and everything else still loads.
      this.logger.error(`Balance lookup failed for ${address}: ${(cause as Error).message}`);
      return null;
    }
  }

  /** Exposed so callers do not re-derive the constant. */
  static get lamportsPerSol() {
    return LAMPORTS_PER_SOL;
  }
}
