"use client";

import { useCallback, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { capture } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "bagsmarkets.theme";

export type Theme = "light" | "dark";

// Runs before first paint to apply the stored theme, so the page never flashes
// the wrong palette. Kept as a string because it must execute synchronously in
// the document head, ahead of React hydration.
export const themeScript = `
(function() {
  try {
    var stored = localStorage.getItem("${STORAGE_KEY}");
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (stored === "dark" || (!stored && prefersDark)) {
      document.documentElement.classList.add("dark");
    }
  } catch (e) {
    // Private browsing can throw on localStorage access; light theme is fine.
  }
})();
`;

// The `dark` class on <html> is the source of truth — themeScript sets it before
// React runs. Subscribing to it rather than mirroring it into state keeps the
// two from drifting, and lets useSyncExternalStore handle the hydration pass.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"]
  });
  return () => observer.disconnect();
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

// The server has no way to know the stored preference, so it always renders the
// light-theme icon; React reconciles after hydration.
function getServerSnapshot(): Theme {
  return "light";
}

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");

    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Non-fatal: the choice just will not survive a reload.
    }

    capture("theme_toggled", { theme: next });
  }, [theme]);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors",
        "hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
