import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { SignInWithWallet } from "@/components/auth/sign-in-with-wallet";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: "Sign in | bagsMarkets"
};

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md space-y-6">
        <Link href="/" className="block text-center text-base font-semibold tracking-tight text-foreground">
          bagsMarkets
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>
              Your Solana wallet is your account. Signing proves you own the address — it does not
              move funds or cost gas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {authConfigured ? (
              // useSearchParams inside needs a boundary, or the whole route
              // opts into dynamic rendering.
              <Suspense fallback={null}>
                <SignInWithWallet />
              </Suspense>
            ) : (
              <p className="text-sm text-muted-foreground">
                Authentication is not configured. Set{" "}
                <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
                <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in{" "}
                <code className="font-mono text-xs">.env.local</code>.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
