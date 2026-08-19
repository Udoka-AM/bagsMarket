"use client";

import { useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { capture } from "@/lib/analytics";
import { captchaEnabled, env } from "@/lib/env";
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
  const captchaRef = useRef<HCaptcha>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * hCaptcha tokens are single-use and short-lived. Any outcome other than a
   * completed sign-in leaves the current one spent, so the widget is reset —
   * otherwise a second attempt fails on a stale token and the message blames
   * the wallet for a CAPTCHA problem.
   */
  function resetCaptcha() {
    captchaRef.current?.resetCaptcha();
    setCaptchaToken(null);
  }

  function fail(message: string) {
    setError(message);
    setPending(false);
    resetCaptcha();
  }

  async function signIn() {
    setPending(true);
    setError(null);

    if (!detectWallet()) {
      fail("No Solana wallet detected. Install Phantom or Solflare, then reload this page.");
      return;
    }

    if (captchaEnabled && !captchaToken) {
      fail("Complete the CAPTCHA first.");
      return;
    }

    capture("wallet_connect_clicked", { method: "siws" });

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithWeb3({
      chain: "solana",
      statement: STATEMENT,
      // Omitted rather than sent empty when disabled: Supabase rejects an empty
      // token outright, which would be worse than not sending one.
      ...(captchaToken ? { options: { captchaToken } } : {})
    });

    if (signInError) {
      fail(
        `${signInError.message}. If this mentions the provider being disabled, enable ` +
          "Web3 (Solana) under Authentication → Sign In / Providers in the Supabase dashboard."
      );
      return;
    }

    // A full navigation rather than router.push: the session cookie was just
    // set, and the middleware only sees it on a fresh request.
    window.location.href = searchParams.get("next") ?? "/dashboard";
  }

  const blocked = pending || (captchaEnabled && !captchaToken);

  return (
    <div className="space-y-4">
      {captchaEnabled ? (
        <div className="flex justify-center">
          <HCaptcha
            ref={captchaRef}
            sitekey={env.hcaptchaSiteKey}
            onVerify={(token) => setCaptchaToken(token)}
            // Tokens expire after roughly two minutes. Clearing on expiry means
            // the button disables itself rather than failing on submit.
            onExpire={() => setCaptchaToken(null)}
            onError={() => {
              setCaptchaToken(null);
              setError("The CAPTCHA failed to load. Check your connection and try again.");
            }}
          />
        </div>
      ) : null}

      <Button size="lg" onClick={signIn} disabled={blocked} className="w-full">
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
