import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/shell/page-placeholder";

export const metadata: Metadata = {
  title: "Alerts | bagsMarkets"
};

export default function AlertsPage() {
  return (
    <PagePlaceholder
      title="Alerts"
      description="Thresholds you set, the notifications they produced, and where each one was delivered."
      phase="Phase 4 - Market Intelligence"
      delivers={[
        "Threshold rules stored in Postgres",
        "Delivery history with per-channel status",
        "AI-generated explanations for why an alert fired",
        "Mute, snooze, and escalation controls"
      ]}
    />
  );
}
