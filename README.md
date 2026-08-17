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

## Next steps

See the [build plan](./docs/build-plan.md). Phases 0 and 1 are complete; Phase 2
is the Postgres schema and shared domain types.


