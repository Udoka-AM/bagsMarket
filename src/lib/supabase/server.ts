import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/**
 * Server-side Supabase client for React Server Components.
 *
 * Cookie writes are swallowed: server components cannot set cookies, and the
 * middleware already refreshes the session on every request. Without the
 * try/catch this throws on any token refresh attempt during render.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component — middleware handles the refresh.
        }
      }
    }
  });
}

/**
 * The access token for the current request, or null when signed out.
 *
 * This is what the API expects as a bearer token; it verifies it against
 * Supabase's JWKS.
 */
export async function getAccessToken(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
