import { ArrowRight, BarChart3, Coins, Workflow } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const capabilities = [
  {
    icon: Coins,
    title: "Bags-native automation",
    description: "Connect launch, fee sharing, analytics, and fee claiming flows with the Bags TypeScript SDK."
  },
  {
    icon: BarChart3,
    title: "Market and social signals",
    description: "Combine market data, GitHub developer signals, X data, and prediction markets into one view."
  },
  {
    icon: Workflow,
    title: "Agent workflows",
    description: "Orchestrate research, alerts, and execution jobs with LangGraph, queues, and scheduled tasks."
  }
];

export default function Home() {
  return (
    <main className="min-h-screen">
      <section className="mx-auto flex min-h-screen max-w-6xl items-center px-6 py-16">
        <div className="grid w-full gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border bg-white/80 px-4 py-2 text-sm text-slate-700 shadow-sm backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Next.js + TypeScript + Tailwind scaffold
            </div>
            <Badge>shadcn/ui-ready</Badge>
            <div className="space-y-4">
              <h1 className="max-w-2xl text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
                bagsMarkets for Bags, Solana, and trading intelligence.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-600">
                This repo is scaffolded for a full-stack product with a Next.js frontend, a NestJS backend,
                PostgreSQL, pgvector, Redis, OpenAI, Solana integrations, and market-data pipelines.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="lg">
                Start building
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="outline" size="lg">
                Review the stack
              </Button>
            </div>
          </div>

          <div className="grid gap-4">
            {capabilities.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.title} className="border-white/70 bg-white/80 shadow-glow backdrop-blur">
                  <CardHeader>
                    <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle>{item.title}</CardTitle>
                    <CardDescription>{item.description}</CardDescription>
                  </CardHeader>
                </Card>
              );
            })}

            <Card className="border-slate-200 bg-slate-950 text-white shadow-glow">
              <CardContent className="space-y-3 p-6">
                <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Planned backend</p>
                <p className="text-lg leading-7 text-slate-100">
                  NestJS service, Postgres schema, and queue workers can be added next without changing the app shell.
                </p>
              </CardContent>
            </Card>
            <Separator className="my-2" />
          </div>
        </div>
      </section>
    </main>
  );
}
