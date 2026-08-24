"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Transaction } from "@solana/web3.js";
import { Button } from "@/components/ui/button";
import { apiClientFetch } from "@/lib/api-client";

type ClaimDraft = { claimId: string; transactions: string[] };

type Provider = {
  signAndSendTransaction: (tx: Transaction) => Promise<{ signature: string }>;
};

/** base64 -> bytes without Buffer, which is not present in the browser. */
function decode(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

type Stage = "idle" | "preparing" | "signing" | "recording" | "done";

export function ClaimButton({
  tokenMint,
  disabled,
  disabledReason
}: {
  tokenMint: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);

  async function claim() {
    setError(null);
    setStage("preparing");

    try {
      const provider = (window as unknown as { solana?: Provider }).solana;

      if (!provider) {
        throw new Error("No Solana wallet detected. Install Phantom or Solflare.");
      }

      // Creates the pending claim row and returns unsigned transactions. The
      // API never signs and never broadcasts — that happens here, in the
      // wallet, so the key never leaves it.
      const draft = await apiClientFetch<ClaimDraft>("/claims", {
        method: "POST",
        body: { tokenMint }
      });

      setStage("signing");

      const signatures: string[] = [];

      // Sequential, not parallel: these can depend on each other, and a wallet
      // shows one prompt at a time regardless.
      for (const encoded of draft.transactions) {
        const { signature } = await provider.signAndSendTransaction(
          Transaction.from(decode(encoded))
        );
        signatures.push(signature);
      }

      setStage("recording");

      // Known limitation: `claims` stores one signature, so a multi-transaction
      // claim records only the first. Reconciliation therefore reflects that
      // one. Every claim seen so far is single-transaction.
      await apiClientFetch(`/claims/${draft.claimId}/signature`, {
        method: "POST",
        body: { signature: signatures[0] }
      });

      setStage("done");
      // The claim is pending until the reconcile job settles it; refreshing
      // shows the new row rather than implying it is already confirmed.
      router.refresh();
    } catch (cause) {
      // Wallet rejection is the common case and is not an error worth shouting
      // about, but it still has to clear the pending row's grip on this mint.
      setError(cause instanceof Error ? cause.message : "The claim could not be completed.");
      setStage("idle");
    }
  }

  const label = {
    idle: "Claim fees",
    preparing: "Preparing…",
    signing: "Approve in your wallet…",
    recording: "Recording…",
    done: "Claim submitted"
  }[stage];

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        onClick={claim}
        disabled={disabled || (stage !== "idle" && stage !== "done")}
        className="w-full"
        title={disabled ? disabledReason : undefined}
      >
        {label}
      </Button>

      {stage === "done" ? (
        <p className="text-xs text-muted-foreground">
          Submitted. It stays pending until the reconciler confirms it on-chain.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-xs text-muted-foreground">
          {error}
        </p>
      ) : null}
    </div>
  );
}
