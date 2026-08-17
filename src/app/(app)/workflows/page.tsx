import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/shell/page-placeholder";

export const metadata: Metadata = {
  title: "Workflows | bagsMarkets"
};

export default function WorkflowsPage() {
  return (
    <PagePlaceholder
      title="Workflows"
      description="Agent runs and scheduled jobs, with the retry and dead-letter state that makes them debuggable."
      phase="Phase 6 - Automation and Ops"
      delivers={[
        "Scheduled ingestion job runs and their outcomes",
        "Agent run traces from the orchestration layer",
        "Retry counts and dead-letter inspection",
        "Audit log of actions taken automatically"
      ]}
    />
  );
}
