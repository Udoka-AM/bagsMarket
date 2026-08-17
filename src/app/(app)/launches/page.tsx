import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/shell/page-placeholder";

export const metadata: Metadata = {
  title: "Launches | bagsMarkets"
};

export default function LaunchesPage() {
  return (
    <PagePlaceholder
      title="Launches"
      description="Bags launches you own or follow, with fee-sharing configuration and claim history."
      phase="Phase 3 - Bags and Solana Integration"
      delivers={[
        "Launch list and detail views backed by the Bags TypeScript SDK",
        "Fee-share splits and participant records",
        "Fee claiming with transaction status feedback",
        "Read-only mode for launches you do not control"
      ]}
    />
  );
}
