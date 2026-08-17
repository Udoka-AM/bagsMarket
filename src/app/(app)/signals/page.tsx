import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/shell/page-placeholder";

export const metadata: Metadata = {
  title: "Signals | bagsMarkets"
};

export default function SignalsPage() {
  return (
    <PagePlaceholder
      title="Signals"
      description="Market, social, and developer signals merged into one feed with watchlists and trend detection."
      phase="Phase 4 - Market Intelligence"
      delivers={[
        "Price and liquidity data from Birdeye and DexScreener",
        "Social signal ingestion from the X API",
        "Repository activity from the GitHub API",
        "Prediction-market inputs where the source permits it",
        "Watchlists and per-signal trend detection"
      ]}
    />
  );
}
