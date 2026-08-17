"use client";

import posthog from "posthog-js";
import { analyticsEnabled } from "@/lib/env";

// Every event the product emits is declared here, so the tracking plan lives in
// one reviewable place instead of being spread across components as loose
// strings.
export type AnalyticsEvent =
  | "nav_item_clicked"
  | "wallet_connect_clicked"
  | "theme_toggled";

export function capture(event: AnalyticsEvent, properties?: Record<string, unknown>) {
  if (!analyticsEnabled) {
    return;
  }

  posthog.capture(event, properties);
}
