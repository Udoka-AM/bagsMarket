# Tech Stack

This document defines the target stack for bagsMarkets. Some pieces are already scaffolded in the repo, while others are planned for later phases.

## Product Goals

- Surface market and developer signals in one place
- Support Bags transaction flows with the Bags TypeScript SDK
- Connect Solana wallet actions and onchain data
- Enrich decisions with AI, social data, market feeds, and prediction markets
- Automate research and operational workflows through jobs and agents

## Current Repository Stack

### Frontend

- Next.js 16.2.12
- React 19.2.0
- TypeScript
- Tailwind CSS
- shadcn/ui-style component structure

### Shared UI and Utilities

- `class-variance-authority`
- `clsx`
- `tailwind-merge`
- `lucide-react`

### Backend Scaffold

- NestJS placeholder under `apps/api`
- Planned as a separate service boundary for API, auth, jobs, and integrations

## Target Product Stack

### Frontend

- Next.js + TypeScript
- Tailwind CSS
- shadcn/ui
- PostHog for analytics

### Backend

- Node.js
- NestJS
- Supabase (hosted PostgreSQL + Auth)
- Drizzle ORM and `drizzle-kit` migrations
- Redis

### Data and Search

- Supabase PostgreSQL as the system of record
- Drizzle as the schema authority — not the Supabase dashboard, and not the
  Supabase CLI migration workflow
- Row Level Security enabled on every table as a backstop behind API-level checks
- pgvector for embeddings and semantic search, enabled in the first migration and
  left unused until Phase 5

### Bags and Solana

- Bags TypeScript SDK
- `@solana/web3.js`
- Solana Wallet Adapter
- Helius RPC

### AI and Automation

- OpenAI API
- LangGraph or custom orchestration
- BullMQ or Trigger.dev for jobs

### External Signals

- X API or provider
- Polymarket, Kalshi, and permitted public prediction feeds
- GitHub API for developer signals
- Birdeye and DexScreener for market data

### Deployment

- Vercel for the frontend
- Railway or AWS for backend services, jobs, and data infrastructure

## Integration Principles

1. Keep the web app thin and composable.
2. Put business logic and integrations behind backend service boundaries.
3. Store normalized application data in Postgres.
4. Use queues for workflows that can fail, retry, or run asynchronously.
5. Treat AI outputs as decision support, not as authoritative system state.

## Environment Variables

See `.env.example` for the authoritative list. The Supabase-specific ones:

| Variable | Where | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | web | Safe to expose |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | web | Safe to expose; RLS is what constrains it |
| `SUPABASE_SERVICE_ROLE_KEY` | api | **Bypasses RLS.** Server-side only, never `NEXT_PUBLIC_` |
| `SUPABASE_JWT_SECRET` | api | Verifies incoming user tokens |
| `DATABASE_URL` | api | Pooled connection, for the running service |
| `DIRECT_URL` | migrations | Unpooled; `drizzle-kit` needs a direct connection |

Plus `REDIS_URL`, `OPENAI_API_KEY`, `HELIUS_RPC_URL`, `BAGS_API_KEY`,
`SOLANA_CLUSTER`, `POSTHOG_KEY`, `X_API_KEY`, and `GITHUB_TOKEN`.

## Notes

- The current web build uses Webpack in production for a stable local build path in this environment.
- When backend services are introduced, the root workspace should be split cleanly so each app owns its own TypeScript and build scope.
