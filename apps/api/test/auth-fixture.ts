import { createServer, type Server } from "node:http";
import { type AddressInfo } from "node:net";
import { SignJWT, exportJWK, generateKeyPair, type CryptoKey } from "jose";

/**
 * A stand-in for Supabase's token issuer.
 *
 * Tokens are signed with a real ES256 key and served through a real JWKS
 * endpoint, so SupabaseJwtService runs its genuine verification path —
 * signature, `kid` lookup, issuer and audience — rather than a stub that would
 * pass no matter what the guard did.
 */
export class AuthFixture {
  private server!: Server;
  private privateKey!: CryptoKey;
  private readonly kid = "test-key-1";

  /** e.g. http://127.0.0.1:54321 — what NEXT_PUBLIC_SUPABASE_URL is set to. */
  supabaseUrl!: string;

  get issuer() {
    return `${this.supabaseUrl}/auth/v1`;
  }

  async start() {
    const { publicKey, privateKey } = await generateKeyPair("ES256", { extractable: true });
    this.privateKey = privateKey;

    const jwk = { ...(await exportJWK(publicKey)), kid: this.kid, alg: "ES256", use: "sig" };

    this.server = createServer((request, response) => {
      if (request.url === "/auth/v1/.well-known/jwks.json") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ keys: [jwk] }));
        return;
      }

      response.writeHead(404).end();
    });

    await new Promise<void>((resolve) => this.server.listen(0, "127.0.0.1", resolve));

    const { port } = this.server.address() as AddressInfo;
    this.supabaseUrl = `http://127.0.0.1:${port}`;
  }

  async stop() {
    await new Promise<void>((resolve, reject) =>
      this.server.close((error) => (error ? reject(error) : resolve()))
    );
  }

  /**
   * Mints a token. Every field is overridable so tests can produce the
   * *nearly* valid tokens that matter — right signature, wrong audience.
   */
  async token(
    options: {
      sub?: string;
      audience?: string;
      issuer?: string;
      walletAddress?: string;
      expiresIn?: string;
      key?: CryptoKey;
    } = {}
  ) {
    const payload: Record<string, unknown> = {
      app_metadata: { provider: "web3", providers: ["web3"] }
    };

    if (options.walletAddress) {
      // The shape Supabase actually produces for a Solana sign-in.
      payload.user_metadata = {
        custom_claims: { chain: "solana", address: options.walletAddress }
      };
    }

    return new SignJWT(payload)
      .setProtectedHeader({ alg: "ES256", kid: this.kid })
      .setSubject(options.sub ?? crypto.randomUUID())
      .setIssuer(options.issuer ?? this.issuer)
      .setAudience(options.audience ?? "authenticated")
      .setIssuedAt()
      .setExpirationTime(options.expiresIn ?? "10m")
      .sign(options.key ?? this.privateKey);
  }

  /** A token signed by a key the JWKS does not publish. */
  async tokenFromForeignKey(sub = crypto.randomUUID()) {
    const { privateKey } = await generateKeyPair("ES256", { extractable: true });
    return this.token({ sub, key: privateKey });
  }
}
