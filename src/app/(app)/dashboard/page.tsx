import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/shell/page-placeholder";

export const metadata: Metadata = {
  title: "Dashboard | bagsMarkets"
};

export default function DashboardPage() {
  return (
    <PagePlaceholder
      title="Dashboard"
      description="The operating view: portfolio position, recent onchain activity, and the health of every running workflow."
      phase="Phase 2 - Core Data Model"
      delivers={[
        "Portfolio and wallet balances read through Helius RPC",
        "Recent activity feed backed by the Postgres activity table",
        "Job and workflow status pulled from the queue",
        "Daily AI summary once Phase 5 orchestration exists"
      ]}
    />
  );
}
