"use client";

import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function SignOutButton({ className }: { className?: string }) {
  async function signOut() {
    await createClient().auth.signOut();

    // A hard navigation, deliberately. signOut() clears the session cookie in
    // the browser; a client-side router.push can render from the RSC cache
    // before the middleware ever re-evaluates, briefly showing signed-in UI to
    // a signed-out user. A full load cannot race that.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/";
  }

  return (
    <button
      type="button"
      onClick={signOut}
      aria-label="Sign out"
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors",
        "hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      <LogOut className="h-4 w-4" />
    </button>
  );
}
