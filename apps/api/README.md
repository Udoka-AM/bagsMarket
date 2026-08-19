# @bagsmarkets/api

NestJS service. Owns authentication, domain logic, and every read and write of
application data — see [architecture.md](../../docs/architecture.md).

```bash
npm run api:dev     # watch mode on :4000
npm run api:build
```

Reads the repo-root `.env.local`. Requires `DATABASE_URL` and
`NEXT_PUBLIC_SUPABASE_URL`; it fails at startup rather than per-query if the
database URL is missing.

## Tests

```bash
docker compose up -d postgres
npm run test:api
```

Runs against a real Postgres with the real migrations applied, and boots the
whole Nest application — so wiring, guards, and DI are covered, not just
individual classes.

**Tokens are real, not stubbed.** `test/auth-fixture.ts` generates an ES256
keypair, serves it from a local JWKS endpoint, and signs tokens with it. That
means `SupabaseJwtService` runs its genuine verification path — signature,
`kid` lookup, issuer, audience, expiry — and the suite can produce the tokens
that actually matter: correctly signed, but with the wrong audience.

That case is the security-critical one. Supabase's anon and service-role keys
are valid JWTs from the same issuer, and service-role bypasses RLS; only the
audience check separates them from a user session. A stubbed verifier would
pass that test no matter what the guard did.

`NODE_ENV=test` makes `AppModule` ignore `.env` files, so the suite cannot
accidentally run against the real Supabase project.

### Verified to fail

The suite has been checked against three deliberate mutations:

| Mutation | Tests that failed |
| --- | --- |
| Audience check removed | wrong-audience rejection |
| Wallet recording removed | wallet primary/verified, idempotency |
| `profileId` filter removed from `/launches` | caller-only isolation |

### Known gap

These tests cover the API. They do **not** cover the web app calling it — which
is exactly the shape of the `/me` bug that shipped: the endpoint was correct and
nothing invoked it. Closing that needs a browser-level smoke test.

## Bags integration

`src/bags/` puts the SDK behind a `BagsPort` interface with two adapters, chosen
at startup:

| Condition | Adapter | `source` |
| --- | --- | --- |
| `BAGS_API_KEY` **and** `HELIUS_RPC_URL` set | `BagsSdkAdapter` | `"bags"` |
| Either missing | `BagsFixtureAdapter` | `"fixture"` |

The seam exists because the SDK takes the API key as a *required constructor
argument* — without one there is nothing to inject at all, so the feature would
otherwise be dark rather than merely keyless.

Every response carries `source`, and the dashboard shows a banner when it is
`"fixture"`. Invented numbers must never read as real ones.

The live adapter has been exercised against the real API. Verifying it needed
two runs, because a wallet with no positions never reaches the mapping code:

1. The signed-in wallet authenticated and returned `[]` — a valid answer, but it
   proves only the call, not the mapping.
2. A wallet found via `state.getTopTokensByLifetimeFees()` →
   `state.getTokenCreators()` held ten real positions, which exercised the
   mapping proper: `claimableLamports` as a string, `isMigrated` as a boolean.

An empty result is therefore known-good rather than assumed-good.

## Balances

`GET /balances` returns the SOL balance for every wallet the caller owns, read
through Helius. Addresses come from our own records, never the request.

`lamports` is `null` when the balance could not be read — no RPC configured, or
the lookup failed — which is deliberately distinct from `"0"`. Telling someone
with funds that their wallet is empty is worse than telling them nothing.

Balances are cached in-process for 15 seconds. The dashboard is force-dynamic, so
every page load would otherwise hit the RPC, and Helius bills per request. The
cache is per-process and lost on restart, so it stops helping once the API runs
more than one instance — that is the point to move it to Redis.
