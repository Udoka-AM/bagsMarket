import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authConfigured, env } from "@/lib/env";

// Routes that require a session. Everything else — the landing page, sign-in —
// stays public.
const PROTECTED_PREFIXES = ["/dashboard", "/launches", "/signals", "/alerts", "/workflows"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!authConfigured) {
    // Without Supabase configured there is no way to establish a session;
    // gating routes here would lock the app with no way in.
    return response;
  }

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      }
    }
  });

  // getUser() revalidates against Supabase rather than trusting the cookie, and
  // refreshes an expired access token as a side effect — which is the reason
  // this middleware exists at all.
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isProtected && !user) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = "/sign-in";
    // Preserved so sign-in can return the user where they were headed.
    signIn.searchParams.set("next", pathname);
    return NextResponse.redirect(signIn);
  }

  if (pathname === "/sign-in" && user) {
    const target = request.nextUrl.clone();
    target.pathname = request.nextUrl.searchParams.get("next") ?? "/dashboard";
    target.search = "";
    return NextResponse.redirect(target);
  }

  return response;
}

export const config = {
  // Skips static assets and images: running auth on every asset request would
  // add a Supabase round trip to each one.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
