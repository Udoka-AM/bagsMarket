# Build Plan

This plan describes the path from the current scaffold to a finished product.

## Phase 0: Foundation

Status: complete

Goals:

- Establish the repository structure
- Define the stack and architecture
- Verify that the web app builds
- Keep the backend scaffold in place for future expansion

Complete:

- Next.js frontend scaffold
- Tailwind and shadcn/ui-ready setup
- NestJS backend placeholder, building via `npm run api:build`
- npm workspaces wiring so `apps/*` installs from the repo root
- Working `lint` and `typecheck` scripts
- Basic docs folder

## Phase 1: Product Shell

Status: complete

Goals:

- Create the authenticated app shell
- Add global navigation
- Add responsive layout patterns
- Connect analytics and basic event tracking
- Add environment configuration and secret handling

Deliverables:

- Header, sidebar, and dashboard layout under the `(app)` route group
- Responsive navigation with a Radix-backed drawer below `lg`
- Wallet connection entry point (instrumented; the adapter lands in Phase 3)
- PostHog page and event instrumentation, off unless a key is configured
- `.env.example` covering both the web app and the API
- Origin allowlist for API CORS, replacing the reflect-any-origin default

Not included, and deliberately deferred:

- Real authentication. The `(app)` layout is the single place a gate will go,
  but there is no session or identity until the API owns one.

## Phase 2: Core Data Model

Status: complete (seed data deliberately deferred, see below)

The decisions behind this phase — Supabase as host, wallet-only identity,
per-user ownership, Drizzle as schema authority — are recorded in
[Architecture Overview](./architecture.md#phase-2-decisions) with their
trade-offs. Read that before changing the schema.

Goals:

- Design the Postgres schema on Supabase
- Add migrations
- Define shared domain types
- Enable pgvector for later semantic search
- Prove the web -> API -> Postgres path end to end

Seed data was deferred out of this phase and landed in Phase 3, once wallet
sign-in provided a real profile to own the rows.

Deliverables:

- `profiles` (hangs off Supabase `auth.users`)
- `wallets`
- `launches`
- `fee_shares`
- `claims`
- `alerts` and `alert_events`
- `jobs`
- `activity`
- RLS policies on every table
- `packages/db` (Drizzle schema, migrations) and `packages/types` (API contracts)
- First vertical slice: `GET /jobs` reads Postgres through Drizzle, and
  `/workflows` renders it. `jobs` was chosen because its `profile_id` is
  nullable, so the slice does not depend on authentication existing first.

## Phase 3: Bags and Solana Integration

Status: in progress — authentication done, Bags and transactions outstanding.

Landed:

- First write path: `POST /claims` returns unsigned transactions for the wallet
  to sign, `POST /claims/:id/signature` records the result. The API never signs
  and never broadcasts. Real broadcast is still unverified — it needs a wallet
  holding a claimable position.
- `GET /balances` — SOL balance per owned wallet via Helius, with a 15-second
  in-process cache, rendered on the dashboard
- Bags SDK integration seam: `@bagsfm/bags-sdk` behind a `BagsPort` interface,
  with a live adapter and a fixture adapter chosen at startup by whether
  `BAGS_API_KEY` and `HELIUS_RPC_URL` are set
- `GET /positions` (claimable fee positions) and a dashboard that renders them,
  clearly marked when the data is fixture rather than real
- Seed script (`npm run db:seed`), idempotent via deterministic `5eed…` ids
- `GET /launches` scoped to the caller, rendered at `/launches`
- Supabase wallet sign-in (`signInWithWeb3`, Solana) with a `/sign-in` page
- API auth: JWKS token verification, issuer and audience checks, `AuthGuard`
- `GET /me`, creating the profile on first authenticated request
- Middleware gating every `(app)` route, preserving the intended destination
- Server components forward the access token to the API

**Prerequisite for sign-in to work:** Web3 (Solana) must be enabled under
Authentication → Sign In / Providers in the Supabase dashboard. It is off by
default, and there is no API for it.

### What the SDK actually offers

Reading `@bagsfm/bags-sdk` changed the plan in three ways:

1. **The API key is a required constructor argument** — `new BagsSDK(apiKey,
   connection)`. There is no keyless read path, so nothing real can be fetched
   until `BAGS_API_KEY` exists. It also needs a Solana RPC connection, which is
   what `HELIUS_RPC_URL` is for; the two are needed together.
2. **There is no "list my launches" call.** The wallet-centric read is
   `fee.getAllClaimablePositions(wallet)` — fee positions, not launches. Our
   `launches` table therefore cannot be populated by asking Bags what a user
   owns; it will need a different source (creation flow, or indexing by mint).
3. **Lamports are typed as JS `number`** in the SDK, and u64 exceeds
   `Number.MAX_SAFE_INTEGER`. Values above ~9.007e15 have already lost precision
   before reaching us. Our own contract keeps them as strings so we do not
   compound it.

**The live adapter is verified.** With real credentials it authenticates, and
the mapping was exercised against a wallet holding ten genuine positions —
`claimableLamports` arrives as a string, `isMigrated` as a boolean, and a wallet
with nothing claimable correctly returns an empty list rather than an error.

Goals:

- Integrate the Bags TypeScript SDK
- Add Solana wallet connection
- Add RPC access through Helius
- Build transaction flows for launch, fee sharing, fee claiming, and analytics-backed views

Deliverables:

- Wallet connect flow
- Read-only portfolio or launch dashboard
- Transaction initiation and status feedback

## Phase 4: Market Intelligence

Goals:

- Ingest market data from Birdeye and DexScreener
- Add X/social signals
- Add GitHub developer signals
- Add prediction market inputs where permitted

Deliverables:

- Signal feeds
- Watchlists
- Trend detection
- Alerting thresholds

## Phase 5: AI and Agent Workflows

Goals:

- Add OpenAI-powered summarization and classification
- Introduce LangGraph or a custom orchestration layer
- Generate insights, recommendations, and action drafts

Deliverables:

- Daily summaries
- Asset or project scoring
- Research assistant workflows
- Automatic alert explanations

## Phase 6: Automation and Ops

Goals:

- Add BullMQ or Trigger.dev jobs
- Add retries and dead-letter handling
- Add system observability
- Add audit logging

Deliverables:

- Scheduled ingestion jobs
- Notification workflows
- Reliable retries
- Operational dashboards

## Phase 7: Production Hardening

Partially done already. Two items were pulled forward because both get more
expensive the longer they wait:

- **CI** (`.github/workflows/ci.yml`) — lint, typechecks, tests, and both builds
  on every push and pull request.
- **RLS policy tests** — the security boundary is asserted against a real
  Postgres, with migrations applied from empty by drizzle's own migrator. Their
  ability to detect a broken policy has itself been verified.

Now also done: rate limiting (`@nestjs/throttler`, IP-keyed, with a standard
`Retry-After`), CORS that fails closed in production, three startup guards that
refuse to boot on a misconfiguration, and [the runbook](./runbook.md).

Still outstanding: **CAPTCHA** — blocked on enabling it in the Supabase dashboard,
since the client needs the resulting site key — and a browser-level smoke test
covering the web app calling the API.

Goals:

- Add security reviews
- Add testing coverage
- Add rate limiting and abuse prevention
- Add rollback and release procedures
- Document production operations

Deliverables:

- Unit and integration tests
- Deployment runbook
- Incident response notes
- CI checks

## Phase 8: Launch Readiness

Goals:

- Finish product polish
- Validate core workflows end to end
- Confirm deployment targets and monitoring
- Prepare onboarding and support docs

Deliverables:

- User guide
- Internal runbook
- Release checklist
- Launch notes

## Definition of Done

The product is finished when:

- Users can authenticate and access the app
- Bags and Solana actions work reliably
- Market intelligence is refreshed automatically
- AI summaries and workflows are accurate enough to trust with human review
- Jobs, retries, logs, and alerts are observable
- Documentation is clear enough for a new engineer to contribute without hand-holding
