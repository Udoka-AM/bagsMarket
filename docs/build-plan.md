# Build Plan

This plan describes the path from the current scaffold to a finished product.

## Phase 0: Foundation

Status: in progress

Goals:

- Establish the repository structure
- Define the stack and architecture
- Verify that the web app builds
- Keep the backend scaffold in place for future expansion

Already complete:

- Next.js frontend scaffold
- Tailwind and shadcn/ui-ready setup
- NestJS backend placeholder
- Basic docs folder

## Phase 1: Product Shell

Goals:

- Create the authenticated app shell
- Add global navigation
- Add responsive layout patterns
- Connect analytics and basic event tracking
- Add environment configuration and secret handling

Deliverables:

- Header, sidebar, and dashboard layout
- Login or wallet connection entry point
- PostHog page and event instrumentation

## Phase 2: Core Data Model

Goals:

- Design the Postgres schema
- Add migrations and seed data
- Define shared domain types
- Introduce pgvector for embeddings and semantic search

Deliverables:

- Users
- Wallets
- Launches
- Claims
- Alerts
- Jobs
- Activity feed

## Phase 3: Bags and Solana Integration

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
