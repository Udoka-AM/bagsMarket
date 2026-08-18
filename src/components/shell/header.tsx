"use client";

import { usePathname } from "next/navigation";
import type { Me } from "@bagsmarkets/types";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ThemeToggle } from "@/components/providers/theme";
import { MobileNav } from "./mobile-nav";
import { navItems } from "./nav-items";

/** Base58 addresses are 32-44 chars — far too long to show whole. */
function truncateAddress(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function Header({ me }: { me: Me | null }) {
  const pathname = usePathname();
  // Deriving the title from the route keeps every page from having to pass it
  // up through the layout.
  const active = navItems.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );

  const primary = me?.wallets.find((wallet) => wallet.isPrimary) ?? me?.wallets[0];
  const label = me?.profile.handle ?? (primary ? truncateAddress(primary.address) : null);

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur sm:px-6">
      <MobileNav />

      <h1 className="flex-1 truncate text-lg font-semibold tracking-tight text-foreground">
        {active?.label ?? "bagsMarkets"}
      </h1>

      {label ? (
        <span
          // The full address is available on hover for anyone who needs to
          // check which wallet they are signed in as.
          title={primary?.address}
          className="hidden rounded-full border border-border px-3 py-1 font-mono text-xs text-muted-foreground sm:inline"
        >
          {label}
        </span>
      ) : null}

      <ThemeToggle />
      <SignOutButton />
    </header>
  );
}
