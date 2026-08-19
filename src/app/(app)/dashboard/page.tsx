import type { Metadata } from "next";
import type { ClaimablePosition, WalletBalance } from "@bagsmarkets/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ApiError, apiFetch } from "@/lib/api";

export const metadata: Metadata = {
  title: "Dashboard | bagsMarkets"
};

export const dynamic = "force-dynamic";

type PositionsResponse = {
  items: ClaimablePosition[];
  source: "bags" | "fixture";
  wallet: string | null;
};

type BalancesResponse = {
  items: WalletBalance[];
  rpcConfigured: boolean;
};

const LAMPORTS_PER_SOL = 1_000_000_000n;

/**
 * Lamports arrive as a string because u64 exceeds Number.MAX_SAFE_INTEGER.
 * Division happens in BigInt and only the small remainder is formatted, so no
 * large value is ever put through a JS number.
 */
function formatSol(lamports: string, decimals = 4) {
  const value = BigInt(lamports);
  const whole = value / LAMPORTS_PER_SOL;
  const fraction = (value % LAMPORTS_PER_SOL).toString().padStart(9, "0").slice(0, decimals);

  return `${whole.toString()}.${fraction}`;
}

function truncate(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export default async function DashboardPage() {
  // Fetched together: one slow call should not serialise behind the other.
  const [positionsResult, balancesResult] = await Promise.allSettled([
    apiFetch<PositionsResponse>("/positions"),
    apiFetch<BalancesResponse>("/balances")
  ]);

  const positions = positionsResult.status === "fulfilled" ? positionsResult.value : null;
  const balances = balancesResult.status === "fulfilled" ? balancesResult.value : null;

  const error =
    positionsResult.status === "rejected"
      ? positionsResult.reason instanceof ApiError
        ? positionsResult.reason.message
        : "Something went wrong loading the dashboard."
      : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-3">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h2>
        <p className="max-w-2xl text-muted-foreground">
          Wallet balance and claimable fee positions.
        </p>
      </div>

      {positions?.source === "fixture" ? (
        <Card className="border-amber-400/50 bg-amber-500/5">
          <CardContent className="space-y-1 p-4">
            <p className="text-sm font-medium text-foreground">Sample position data</p>
            <p className="text-sm text-muted-foreground">
              No <code className="font-mono text-xs">BAGS_API_KEY</code> is configured, so the
              positions below are invented.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <Card>
          <CardContent className="space-y-2 p-6">
            <p className="text-sm font-medium text-foreground">Could not load the dashboard</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <p className="text-sm text-muted-foreground">
              Start the API with <code className="font-mono text-xs">npm run api:dev</code>.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {balances && balances.items.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Wallet balance
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {balances.items.map((balance) => (
              <Card key={balance.address}>
                <CardContent className="space-y-2 p-5">
                  <span title={balance.address} className="font-mono text-xs text-muted-foreground">
                    {truncate(balance.address)}
                  </span>
                  {balance.lamports === null ? (
                    // Not "0" — we do not know the balance, and saying zero to
                    // someone with funds would be worse than saying nothing.
                    <p className="text-sm text-muted-foreground">
                      {balances.rpcConfigured
                        ? "Balance unavailable — the RPC did not respond."
                        : "Set HELIUS_RPC_URL to show balances."}
                    </p>
                  ) : (
                    <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                      {formatSol(balance.lamports)}
                      <span className="ml-1 text-sm font-normal text-muted-foreground">SOL</span>
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Claimable positions
        </h3>

        {!positions || positions.wallet === null ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">
                No wallet on file yet. Sign in with a Solana wallet to see claimable positions.
              </p>
            </CardContent>
          </Card>
        ) : positions.items.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">
                Nothing claimable right now for this wallet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {positions.items.map((position) => (
              <Card key={position.baseMint}>
                <CardContent className="space-y-2 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span title={position.baseMint} className="font-mono text-xs text-muted-foreground">
                      {truncate(position.baseMint)}
                    </span>
                    <Badge>{position.isMigrated ? "migrated" : "bonding curve"}</Badge>
                  </div>
                  <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                    {formatSol(position.claimableLamports)}
                    <span className="ml-1 text-sm font-normal text-muted-foreground">SOL</span>
                  </p>
                  <p className="text-xs text-muted-foreground">claimable</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
