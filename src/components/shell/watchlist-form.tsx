"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClientFetch } from "@/lib/api-client";

export function WatchlistForm() {
  const router = useRouter();
  const [ref, setRef] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      await apiClientFetch("/watchlist", { method: "POST", body: { ref: ref.trim() } });
      setRef("");
      // The first snapshot is queued by the API, so the row appears with no
      // metrics until the job runs — refreshing shows it either way.
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add that repository.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={add} className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={ref}
          onChange={(event) => setRef(event.target.value)}
          placeholder="owner/repo"
          aria-label="GitHub repository"
          className="font-mono"
        />
        <Button type="submit" disabled={pending || ref.trim().length === 0}>
          {pending ? "Adding…" : "Watch"}
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-xs text-muted-foreground">
          {error}
        </p>
      ) : null}
    </form>
  );
}
