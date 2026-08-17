"use client";

import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { capture } from "@/lib/analytics";
import { env } from "@/lib/env";

// Entry point only. The Solana Wallet Adapter integration lands in Phase 3;
// until then this records intent so we can see demand before building the flow.
export function WalletButton() {
  return (
    <Button
      variant="outline"
      onClick={() => capture("wallet_connect_clicked", { cluster: env.solanaCluster })}
    >
      <Wallet className="mr-2 h-4 w-4" />
      Connect wallet
    </Button>
  );
}
