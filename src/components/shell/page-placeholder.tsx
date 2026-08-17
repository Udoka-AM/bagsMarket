import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// These surfaces have no data source yet. Rather than render invented numbers,
// each page states what it will show and which build phase delivers it.
export function PagePlaceholder({
  title,
  description,
  phase,
  delivers
}: {
  title: string;
  description: string;
  phase: string;
  delivers: string[];
}) {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-3">
        <Badge>{phase}</Badge>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="max-w-2xl text-muted-foreground">{description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Not wired up yet</CardTitle>
          <CardDescription>
            The shell and routing are in place. This view stays empty until the API and data model land.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {delivers.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden className="text-muted-foreground/60">
                  &middot;
                </span>
                {item}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
