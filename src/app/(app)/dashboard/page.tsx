import type { Metadata } from "next";
import type { ClaimablePosition } from "@bagsmarkets/types";
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

const LAMPORTS_PER_SOL = 1_000_000_000n;

/**
 * Lamports arrive as a string because u64 exceeds Number.MAX_SAFE_INTEGER.
 * The division is done in BigInt and only the small remainder is formatted, so
 * no large value is ever put through a JS number.
 */
function formatSol(lamports: string) {
  const value = BigInt(lamports);
  const whole = value / LAMPORTS_PER_SOL;
  const fraction = (value % LAMPORTS_PER_SOL).toString().padStart(9, "0").slice(0, 4);

  return `${whole.toString()}.${fraction}`;
}

export default async function DashboardPage() {
  let data: PositionsResponse | null = null;
  let error: string | null = null;

  try {
    data = await apiFetch<PositionsResponse>("/positions");
  } catch (cause) {
    error = cause instanceof ApiError ? cause.message : "Something went wrong loading positions.";
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-3">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h2>
        <p className="max-w-2xl text-muted-foreground">
          Claimable fee positions for your connected wallet.
        </p>
      </div>

      {data?.source === "fixture" ? (
        <Card className="border-amber-400/50 bg-amber-500/5">
          <CardContent className="space-y-1 p-4">
            <p className="text-sm font-medium text-foreground">Sample data</p>
            <p className="text-sm text-muted-foreground">
              No <code className="font-mono text-xs">BAGS_API_KEY</code> is configured, so these
              figures are invented. Set it and{" "}
              <code className="font-mono text-xs">HELIUS_RPC_URL</code> to show real positions.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <Card>
          <CardContent className="space-y-2 p-6">
            <p className="text-sm font-medium text-foreground">Could not load positions</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <p className="text-sm text-muted-foreground">
              Start the API with <code className="font-mono text-xs">npm run api:dev</code>.
            </p>
          </CardContent>
        </Card>
      ) : !data || data.wallet === null ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">
              No wallet on file yet. Sign in with a Solana wallet to see claimable positions.
            </p>
          </CardContent>
        </Card>
      ) : data.items.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">
              Nothing claimable right now for this wallet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.items.map((position) => (
            <Card key={position.baseMint}>
              <CardContent className="space-y-2 p-5">
                <div className="flex items-center justify-between gap-3">
                  <span
                    title={position.baseMint}
                    className="font-mono text-xs text-muted-foreground"
                  >
                    {position.baseMint.slice(0, 4)}…{position.baseMint.slice(-4)}
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
    </div>
  );
}
