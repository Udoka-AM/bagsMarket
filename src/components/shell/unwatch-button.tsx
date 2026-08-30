"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { apiClientFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export function UnwatchButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function remove() {
    setPending(true);
    try {
      await apiClientFetch(`/watchlist/${id}`, { method: "DELETE" });
      router.refresh();
    } catch {
      // Nothing destructive happened; the row is simply still there.
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={pending}
      aria-label={`Stop watching ${label}`}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors",
        "hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        pending && "opacity-50"
      )}
    >
      <X className="h-3.5 w-3.5" />
    </button>
  );
}
