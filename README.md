# bagsMarkets
bagsMarkets is a market-intelligence and trading operations workspace built around Bags, Solana, and automated agent workflows.

## Stack

- Frontend: Next.js + TypeScript
- UI: Tailwind CSS + shadcn/ui
- Backend: Node.js/NestJS
- Database: PostgreSQL
- Vector search: pgvector
- Bags SDK: Bags TypeScript SDK
- Blockchain: `@solana/web3.js`
- Wallets: Solana Wallet Adapter
- RPC: Helius
- AI: OpenAI API
- Workflows: LangGraph or custom orchestration
- Jobs: BullMQ or Trigger.dev
- Cache: Redis
- Social data: X API/provider
- Prediction data: Polymarket, Kalshi, and permitted public feeds
- Developer signals: GitHub API
- Market data: Birdeye, DexScreener
- Analytics: PostHog
- Deployment: Vercel + Railway or AWS

## What’s here

- A Next.js App Router app shell: sidebar, header, responsive drawer, light/dark theme
- Product routes for dashboard, launches, signals, alerts, and workflows — routed
  and styled, but not yet connected to any data source
- A NestJS service under `apps/api` with a health endpoint and env-driven config
- PostHog instrumentation that stays off until a key is set
- npm workspaces, with `lint`, `typecheck`, and both builds passing

## Getting started

```bash
npm install
cp .env.example .env.local
npm run dev
```

The web app runs on `http://localhost:3000`. To run the API alongside it:

```bash
npm run api:dev
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build of the web app |
| `npm run lint` | ESLint across the repo |
| `npm run typecheck` | `tsc --noEmit` for the web app |
| `npm run api:dev` | NestJS service in watch mode |
| `npm run api:build` | Build the NestJS service |
| `npm run packages:build` | Compile `packages/*` (run automatically by the API scripts) |
| `npm run db:generate` | Diff the Drizzle schema into a new migration |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:studio` | Browse the database |
| `npm run db:seed` | Development fixtures (safe to re-run) |
| `npm test` | RLS policy tests against a real Postgres (needs `docker compose up -d postgres`) |
| `npm run lock:check` | Verify the lock still has the Linux binaries CI needs |
| `npm run lock:refresh` | Rebuild `package-lock.json` with all platforms' native binaries (see below) |

## Tests and CI

```bash
docker compose up -d postgres
npm test
```

GitHub Actions runs lint, typechecks, the RLS suite against a throwaway Postgres,
and both builds on every push and pull request. See
[.github/workflows/ci.yml](.github/workflows/ci.yml).

### If CI fails on `npm ci`

npm records optional, platform-specific binaries only for the platform that
resolved them, so a lock file built on macOS can be missing what Linux CI needs.
The failure is quiet — everything still works locally.

**Run this after any dependency change, before pushing:**

```bash
npm run lock:refresh
```

Adding a dependency with `npm install <pkg>` usually preserves the existing
multi-platform entries — but not when the new package brings native binaries of
its own, and that has broken CI three times now (`@emnapi/*` via sharp,
`bufferutil` via Supabase realtime, then the test runner's rolldown bindings).
Refreshing costs a minute; discovering it in CI costs a round trip.

To confirm before pushing:

```bash
docker run --rm --platform linux/amd64 -v "$PWD":/w -w /w node:24-slim npm ci
```

That regenerates it inside glibc Linux and resyncs `node_modules`. Never fix it
by deleting `package-lock.json` and running `npm install` on macOS — that is the
thing that causes the problem.

## Deploying

See [docs/runbook.md](./docs/runbook.md) — environment, order of operations,
rollback, and what each startup guard means when it fires.

## Context

[details.md](./details.md) collects the current state, the decisions behind it,
and the traps that have already cost time once — read it before changing
anything structural.

## Next steps

See the [build plan](./docs/build-plan.md). Phases 0 and 1 are complete, and
Phase 2 has landed: the schema is live on Supabase with RLS, and `GET /jobs` →
`/workflows` proves the web → API → Postgres path end to end.

Phase 3 is next — the Bags SDK, Solana wallet connection, and the wallet sign-in
flow that finally gives the app a real identity to hang data off.


