"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { analyticsEnabled, env } from "@/lib/env";

// The App Router does not emit page views on client-side navigation, so we send
// them ourselves. `useSearchParams` opts the subtree into client rendering,
// which is why this sits in its own Suspense-wrapped component.
function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!analyticsEnabled) {
      return;
    }

    const query = searchParams.toString();
    posthog.capture("$pageview", {
      $current_url: `${window.location.origin}${pathname}${query ? `?${query}` : ""}`
    });
  }, [pathname, searchParams]);

  return null;
}

export function Analytics({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!analyticsEnabled) {
      return;
    }

    posthog.init(env.posthogKey, {
      api_host: env.posthogHost,
      // We capture page views manually above; the automatic listener misses
      // App Router transitions and double-counts the first load.
      capture_pageview: false,
      person_profiles: "identified_only"
    });
  }, []);

  if (!analyticsEnabled) {
    return <>{children}</>;
  }

  return (
    <PostHogProvider client={posthog}>
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
      {children}
    </PostHogProvider>
  );
}
