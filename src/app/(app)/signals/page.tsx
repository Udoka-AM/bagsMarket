import type { Metadata } from "next";
import type { Signal, WatchlistItem } from "@bagsmarkets/types";
import { UnwatchButton } from "@/components/shell/unwatch-button";
import { WatchlistForm } from "@/components/shell/watchlist-form";
import { Card, CardContent } from "@/components/ui/card";
import { ApiError, apiFetch } from "@/lib/api";

export const metadata: Metadata = {
  title: "Signals | bagsMarkets"
};

export const dynamic = "force-dynamic";

function relative(iso: string | null) {
  if (!iso) {
    return "never";
  }

  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / (60 * 24))}d ago`;
}

export default async function SignalsPage() {
  const [signalsResult, watchlistResult] = await Promise.allSettled([
    apiFetch<{ items: Signal[] }>("/signals"),
    apiFetch<{ items: WatchlistItem[] }>("/watchlist")
  ]);

  const signals = signalsResult.status === "fulfilled" ? signalsResult.value.items : [];
  const watchlist = watchlistResult.status === "fulfilled" ? watchlistResult.value.items : [];
  const error =
    signalsResult.status === "rejected"
      ? signalsResult.reason instanceof ApiError
        ? signalsResult.reason.message
        : "Something went wrong loading signals."
      : null;

  // Signals carry no id; the watchlist row does, and that is what removal needs.
  const idByRef = new Map(watchlist.map((item) => [item.ref, item.id]));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-3">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Signals</h2>
        <p className="max-w-2xl text-muted-foreground">
          Developer activity for repositories you follow, refreshed on a schedule.
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          <WatchlistForm />
        </CardContent>
      </Card>

      {error ? (
        <Card>
          <CardContent className="space-y-2 p-6">
            <p className="text-sm font-medium text-foreground">Could not load signals</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <p className="text-sm text-muted-foreground">
              Start the API with <code className="font-mono text-xs">npm run api:dev</code>.
            </p>
          </CardContent>
        </Card>
      ) : signals.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">
              Nothing on your watchlist yet. Add a GitHub repository above — try{" "}
              <code className="font-mono text-xs">anza-xyz/agave</code>.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {signals.map((signal) => (
            <Card key={signal.ref}>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-sm font-medium text-foreground">{signal.ref}</p>
                    <p className="text-xs text-muted-foreground">
                      updated {relative(signal.capturedAt)}
                      {signal.metrics?.language ? ` · ${signal.metrics.language}` : ""}
                      {signal.metrics?.archived ? " · archived" : ""}
                    </p>
                  </div>
                  {idByRef.has(signal.ref) ? (
                    <UnwatchButton id={idByRef.get(signal.ref)!} label={signal.ref} />
                  ) : null}
                </div>

                {signal.metrics === null ? (
                  // Not zeros — nothing has been measured yet, which is a
                  // different statement from "this project is dead".
                  <p className="text-sm text-muted-foreground">
                    Waiting for the first reading. Ingestion runs on a schedule.
                  </p>
                ) : (
                  <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { label: "commits 7d", value: signal.metrics.commits7d, emphasis: true },
                      { label: "stars", value: signal.metrics.stars },
                      { label: "forks", value: signal.metrics.forks },
                      { label: "open issues", value: signal.metrics.openIssues }
                    ].map((metric) => (
                      <div key={metric.label}>
                        <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                          {metric.label}
                        </dt>
                        <dd
                          className={
                            metric.emphasis
                              ? "text-xl font-semibold tabular-nums text-foreground"
                              : "text-xl font-semibold tabular-nums text-muted-foreground"
                          }
                        >
                          {metric.value.toLocaleString()}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
