import type { Job, JobStatus } from "@bagsmarkets/types";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Status drives colour, so the eye can find failures without reading. Kept as a
// full record rather than a lookup with a fallback, so adding a JobStatus to the
// contract fails the build here instead of rendering as unstyled text.
const statusStyles: Record<JobStatus, string> = {
  queued: "border-slate-300/60 bg-slate-500/10 text-slate-600 dark:text-slate-300",
  running: "border-blue-400/60 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  succeeded: "border-emerald-400/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  failed: "border-amber-400/60 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  dead: "border-red-400/60 bg-red-500/10 text-red-700 dark:text-red-300"
};

function formatTime(iso: string | null) {
  if (!iso) {
    return "—";
  }

  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function JobList({ jobs }: { jobs: Job[] }) {
  if (jobs.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">
            No jobs have run yet. Scheduled ingestion arrives in Phase 6.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th scope="col" className="py-2 pr-4 font-medium">Job</th>
            <th scope="col" className="py-2 pr-4 font-medium">Status</th>
            <th scope="col" className="py-2 pr-4 font-medium">Attempts</th>
            <th scope="col" className="py-2 pr-4 font-medium">Scheduled</th>
            <th scope="col" className="py-2 font-medium">Finished</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id} className="border-b border-border/60 last:border-0">
              <td className="py-3 pr-4">
                <span className="font-medium text-foreground">{job.kind}</span>
                {job.lastError ? (
                  <p className="mt-1 max-w-md text-xs text-muted-foreground">{job.lastError}</p>
                ) : null}
              </td>
              <td className="py-3 pr-4">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                    statusStyles[job.status]
                  )}
                >
                  {job.status}
                </span>
              </td>
              <td className="py-3 pr-4 tabular-nums text-muted-foreground">
                {job.attempts}/{job.maxAttempts}
              </td>
              <td className="py-3 pr-4 text-muted-foreground">{formatTime(job.scheduledFor)}</td>
              <td className="py-3 text-muted-foreground">{formatTime(job.finishedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
