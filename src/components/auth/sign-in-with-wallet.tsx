"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { capture } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";

// Shown in the wallet's signature prompt, so it has to read as something a
// person can consent to rather than an opaque challenge.
const STATEMENT =
  "Sign in to bagsMarkets. This request will not trigger a transaction or cost gas.";

type WalletProvider = { isPhantom?: boolean };

function detectWallet(): WalletProvider | null {
  if (typeof window === "undefined") {
    return null;
  }

  // Phantom, Solflare and friends all inject `window.solana`.
  return (window as unknown as { solana?: WalletProvider }).solana ?? null;
}

export function SignInWithWallet() {
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setPending(true);
    setError(null);

    if (!detectWallet()) {
      setError("No Solana wallet detected. Install Phantom or Solflare, then reload this page.");
      setPending(false);
      return;
    }

    capture("wallet_connect_clicked", { method: "siws" });

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithWeb3({
      chain: "solana",
      statement: STATEMENT
    });

    if (signInError) {
      // The most likely failure in a fresh project is the Web3 provider being
      // disabled, which Supabase reports as a generic validation error — so the
      // message points at the setting rather than leaving a dead end.
      setError(
        `${signInError.message}. If this mentions the provider being disabled, enable ` +
          "Web3 (Solana) under Authentication → Sign In / Providers in the Supabase dashboard."
      );
      setPending(false);
      return;
    }

    // A full navigation rather than router.push: the session cookie was just
    // set, and the middleware only sees it on a fresh request.
    window.location.href = searchParams.get("next") ?? "/dashboard";
  }

  return (
    <div className="space-y-3">
      <Button size="lg" onClick={signIn} disabled={pending} className="w-full">
        <Wallet className="mr-2 h-4 w-4" />
        {pending ? "Check your wallet…" : "Sign in with Solana wallet"}
      </Button>

      {error ? (
        <p role="alert" className="text-sm text-muted-foreground">
          {error}
        </p>
      ) : null}
    </div>
  );
}
