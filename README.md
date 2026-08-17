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

## What’s in this scaffold

- A Next.js App Router application shell
- TypeScript configuration and path aliases
- Tailwind setup ready for shadcn/ui components
- A starter landing page for the product
- A reusable button and card component

## Next steps

1. Install dependencies.
2. Wire the app to Bags, Solana, and OpenAI services.
3. Add the NestJS backend and Postgres schema.
4. Build the first user flows and analytics events.


