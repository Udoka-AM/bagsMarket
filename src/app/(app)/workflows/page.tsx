import type { Metadata } from "next";
import type { Job, Paginated } from "@bagsmarkets/types";
import { JobList } from "@/components/shell/job-list";
import { Card, CardContent } from "@/components/ui/card";
import { ApiError, apiFetch } from "@/lib/api";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Workflows | bagsMarkets"
};

// Job state changes constantly, so this page is never prerendered.
export const dynamic = "force-dynamic";

export default async function WorkflowsPage() {
  let jobs: Job[] = [];
  let error: string | null = null;

  try {
    const response = await apiFetch<Paginated<Job>>("/jobs");
    jobs = response.items;
  } catch (cause) {
    // A page that renders "the API is down" is more useful than one that throws
    // a 500 at the reader, especially in development where it is usually just
    // not running.
    error =
      cause instanceof ApiError
        ? cause.message
        : "Something went wrong loading jobs.";
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-3">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Workflows</h2>
        <p className="max-w-2xl text-muted-foreground">
          Background jobs, with the retry and dead-letter state that makes them debuggable. A job
          marked <span className="font-medium text-foreground">dead</span> has spent its attempts
          and will not run again without a person.
        </p>
      </div>

      {error ? (
        <Card>
          <CardContent className="space-y-2 p-6">
            <p className="text-sm font-medium text-foreground">Could not load jobs</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <p className="text-sm text-muted-foreground">
              Start the API with <code className="font-mono text-xs">npm run api:dev</code>, or check
              that <code className="font-mono text-xs">NEXT_PUBLIC_API_URL</code> points at{" "}
              {env.apiUrl}.
            </p>
          </CardContent>
        </Card>
      ) : (
        <JobList jobs={jobs} />
      )}
    </div>
  );
}
