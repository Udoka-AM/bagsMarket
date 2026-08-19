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
  solanaCluster: process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  hcaptchaSiteKey: process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY ?? ""
} as const;

// Auth is unavailable rather than broken when Supabase is not configured, so
// the sign-in page can say so instead of throwing on a missing key.
export const authConfigured =
  env.supabaseUrl.length > 0 && env.supabaseAnonKey.length > 0;

/**
 * Whether sign-in should present a CAPTCHA.
 *
 * Off without a site key, so local development does not require one. This must
 * match the Supabase project setting: if Supabase enforces CAPTCHA and the
 * client does not send a token, every sign-in fails with a confusing error.
 */
export const captchaEnabled = env.hcaptchaSiteKey.length > 0;

// Analytics stays off until a key is configured, so local development and
// preview builds do not emit events.
export const analyticsEnabled = env.posthogKey.length > 0;
