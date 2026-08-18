import type { Metadata } from "next";
import type { Launch, LaunchStatus, Paginated } from "@bagsmarkets/types";
import { Card, CardContent } from "@/components/ui/card";
import { ApiError, apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Launches | bagsMarkets"
};

// Ownership is per-request, so this is never prerendered.
export const dynamic = "force-dynamic";

// A full record rather than a lookup with a fallback: adding a status to the
// contract then fails the build here instead of rendering as unstyled text.
const statusStyles: Record<LaunchStatus, string> = {
  draft: "border-slate-300/60 bg-slate-500/10 text-slate-600 dark:text-slate-300",
  pending: "border-amber-400/60 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  live: "border-emerald-400/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  failed: "border-red-400/60 bg-red-500/10 text-red-700 dark:text-red-300",
  closed: "border-slate-400/60 bg-slate-500/10 text-slate-600 dark:text-slate-300"
};

function formatDate(iso: string | null) {
  if (!iso) {
    return "—";
  }

  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

/** Mint addresses are 32-44 chars; show enough to recognise, not the whole thing. */
function truncateMint(mint: string | null) {
  return mint ? `${mint.slice(0, 4)}…${mint.slice(-4)}` : "—";
}

export default async function LaunchesPage() {
  let launches: Launch[] = [];
  let error: string | null = null;

  try {
    const response = await apiFetch<Paginated<Launch>>("/launches");
    launches = response.items;
  } catch (cause) {
    error =
      cause instanceof ApiError ? cause.message : "Something went wrong loading launches.";
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-3">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Launches</h2>
        <p className="max-w-2xl text-muted-foreground">
          Bags launches you own, with fee-sharing configuration and claim history.
        </p>
      </div>

      {error ? (
        <Card>
          <CardContent className="space-y-2 p-6">
            <p className="text-sm font-medium text-foreground">Could not load launches</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <p className="text-sm text-muted-foreground">
              Start the API with <code className="font-mono text-xs">npm run api:dev</code>.
            </p>
          </CardContent>
        </Card>
      ) : launches.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">
              No launches yet. Run <code className="font-mono text-xs">npm run db:seed</code> for
              development fixtures, or connect the Bags SDK to pull real ones.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[38rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="py-2 pr-4 font-medium">Launch</th>
                <th scope="col" className="py-2 pr-4 font-medium">Status</th>
                <th scope="col" className="py-2 pr-4 font-medium">Mint</th>
                <th scope="col" className="py-2 font-medium">Launched</th>
              </tr>
            </thead>
            <tbody>
              {launches.map((launch) => (
                <tr key={launch.id} className="border-b border-border/60 last:border-0">
                  <td className="py-3 pr-4">
                    <span className="font-medium text-foreground">{launch.name}</span>
                    {launch.symbol ? (
                      <span className="ml-2 font-mono text-xs text-muted-foreground">
                        {launch.symbol}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                        statusStyles[launch.status]
                      )}
                    >
                      {launch.status}
                    </span>
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">
                    <span title={launch.tokenMint ?? undefined}>{truncateMint(launch.tokenMint)}</span>
                  </td>
                  <td className="py-3 text-muted-foreground">{formatDate(launch.launchedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
