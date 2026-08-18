import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export type AuthenticatedUser = {
  /** Supabase auth.users.id — the value auth.uid() returns, and our profiles PK. */
  id: string;
  email: string | null;
  /** How the user proved identity: "email", "solana", etc. */
  provider: string | null;
};

@Injectable()
export class SupabaseJwtService {
  private readonly logger = new Logger(SupabaseJwtService.name);
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;
  private readonly issuer: string;

  constructor(config: ConfigService) {
    const url = config.get<string>("NEXT_PUBLIC_SUPABASE_URL");

    if (!url) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set; the API cannot verify user tokens.");
    }

    this.issuer = `${url}/auth/v1`;

    // Supabase signs access tokens with rotating asymmetric keys (ES256) and
    // publishes them at this endpoint. Verifying against JWKS rather than the
    // legacy symmetric SUPABASE_JWT_SECRET is what makes key rotation a
    // non-event: jose caches the key set and refetches when it sees a new kid.
    this.jwks = createRemoteJWKSet(new URL(`${this.issuer}/.well-known/jwks.json`));
  }

  async verify(token: string): Promise<AuthenticatedUser> {
    let payload: JWTPayload;

    try {
      ({ payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        // Supabase issues `authenticated` for signed-in users. Checking it stops
        // a service-role or anon key — both valid JWTs from the same issuer —
        // from being accepted as a user session.
        audience: "authenticated"
      }));
    } catch (cause) {
      // Logged at debug: an invalid token is an expected client error, not an
      // incident, and logging the token itself would leak a credential.
      this.logger.debug(`Token verification failed: ${(cause as Error).message}`);
      throw new UnauthorizedException("Invalid or expired token");
    }

    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      throw new UnauthorizedException("Token has no subject");
    }

    const appMetadata = payload.app_metadata as { provider?: string } | undefined;

    return {
      id: payload.sub,
      email: typeof payload.email === "string" ? payload.email : null,
      provider: appMetadata?.provider ?? null
    };
  }
}
