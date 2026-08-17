// Public, client-safe configuration.
//
// Next inlines `process.env.NEXT_PUBLIC_*` at build time only when it sees the
// full static property access, so these must stay written out longhand — no
// destructuring, no dynamic indexing.
//
// Server-only secrets (OPENAI_API_KEY, BAGS_API_KEY, DATABASE_URL, ...) belong
// to the NestJS service and must never be read from this file.
export const env = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  posthogKey: process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "",
  posthogHost: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
  solanaCluster: process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet"
} as const;

// Analytics stays off until a key is configured, so local development and
// preview builds do not emit events.
export const analyticsEnabled = env.posthogKey.length > 0;
