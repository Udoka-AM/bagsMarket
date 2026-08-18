import type { Me } from "@bagsmarkets/types";
import { Header } from "@/components/shell/header";
import { Sidebar } from "@/components/shell/sidebar";
import { apiFetch } from "@/lib/api";

// Session state changes per request, so this shell is never prerendered.
export const dynamic = "force-dynamic";

/**
 * Shell for every authenticated product surface.
 *
 * The middleware has already established there is a session by the time this
 * renders. Calling /me here is what materialises the profile row on first
 * sign-in — Supabase creates auth.users, but nothing else does. Doing it in the
 * layout means every authenticated route triggers it, so there is no path into
 * the app that leaves a user without a profile.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let me: Me | null = null;

  try {
    me = await apiFetch<Me>("/me");
  } catch {
    // The API being down should not blank the whole app: the shell still
    // renders, and each page reports its own failure. The profile gets created
    // on the next successful load.
    me = null;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header me={me} />
        <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
