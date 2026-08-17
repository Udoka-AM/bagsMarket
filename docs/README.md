# Project Docs

This folder explains what bagsMarkets is, what we are building, and how the system is organized.

Start here:

1. [Tech Stack](./tech-stack.md)
2. [Architecture Overview](./architecture.md)
3. [Build Plan](./build-plan.md)

## Purpose

bagsMarkets is a market-intelligence and workflow platform for Bags and Solana-native activity. The product combines transaction flows, analytics, prediction and market data, social and developer signals, and AI-driven workflows into one operating surface.

## Current State

Phases 0 and 1 of the [build plan](./build-plan.md) are complete.

- Frontend: Next.js + TypeScript + Tailwind, with an app shell under the `(app)`
  route group — sidebar, header, responsive drawer, and light/dark theming
- Product surfaces: `/dashboard`, `/launches`, `/signals`, `/alerts`, `/workflows`.
  Each renders an honest empty state naming the phase that fills it in — none of
  them are wired to a data source yet
- Backend: NestJS service under `apps/api` with a health endpoint, config
  loading, and an explicit CORS origin allowlist
- Analytics: PostHog page views and a typed event list, inert without a key
- Repository: npm workspaces, with `lint`, `typecheck`, and both builds passing

## Running It

```bash
npm install
cp .env.example .env.local   # web
npm run dev                  # http://localhost:3000
npm run api:dev              # http://localhost:4000
```
