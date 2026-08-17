import type { Metadata } from "next";
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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
