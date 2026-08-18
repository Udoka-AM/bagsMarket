"use client";

import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/providers/theme";
import { MobileNav } from "./mobile-nav";
import { navItems } from "./nav-items";
import { SignOutButton } from "@/components/auth/sign-out-button";

export function Header() {
  const pathname = usePathname();
  // Deriving the title from the route keeps every page from having to pass it
  // up through the layout.
  const active = navItems.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur sm:px-6">
      <MobileNav />

      <h1 className="flex-1 truncate text-lg font-semibold tracking-tight text-foreground">
        {active?.label ?? "bagsMarkets"}
      </h1>

      <ThemeToggle />
      <SignOutButton />
    </header>
  );
}
