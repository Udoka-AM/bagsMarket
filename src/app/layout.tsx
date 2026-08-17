import type { Metadata } from "next";
import Script from "next/script";
import { Analytics } from "@/components/providers/posthog-provider";
import { themeScript } from "@/components/providers/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "bagsMarkets",
  description: "Market intelligence and trading operations for Bags, Solana, and agent-driven workflows."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // scroll-behavior is set in globals.css; the attribute tells Next to
    // suppress it during route transitions.
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        {/* Applies the stored theme before first paint to avoid a flash. */}
        <Script id="theme" strategy="beforeInteractive">
          {themeScript}
        </Script>
        <Analytics>{children}</Analytics>
      </body>
    </html>
  );
}
