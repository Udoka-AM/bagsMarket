import Link from "next/link";
import { Nav } from "./nav";
import { env } from "@/lib/env";

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-card/60 lg:flex lg:flex-col">
      <div className="flex h-16 items-center border-b border-border px-6">
        <Link href="/" className="text-base font-semibold tracking-tight text-foreground">
          bagsMarkets
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <Nav />
      </div>

      <div className="border-t border-border p-4">
        <p className="text-xs text-muted-foreground">
          Cluster: <span className="font-medium text-foreground">{env.solanaCluster}</span>
        </p>
      </div>
    </aside>
  );
}
