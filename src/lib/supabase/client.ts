"use client";

import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

/**
 * Browser-side Supabase client.
 *
 * Only ever used for authentication — proving wallet ownership and holding the
 * session. Application data goes through the API, per the boundary in
 * docs/architecture.md.
 *
 * @supabase/ssr stores the session in cookies rather than localStorage, which
 * is what lets server components read it and forward the token to the API.
 */
export function createClient() {
  return createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
}
