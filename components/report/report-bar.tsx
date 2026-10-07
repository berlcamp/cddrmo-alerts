import type { ConnectionStatus } from '@/hooks/use-live-report';
import { Badge } from '@/components/ui/badge';
import { LiveIndicator } from './live-indicator';

export function ReportBar({ title, heading, isLatest, status, lastUpdated }: {
  title: string;
  heading: string;
  isLatest: boolean;
  status: ConnectionStatus;
  lastUpdated: string;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Nagkahiusang Alerto sa Ozamiz Netcall Report</p>
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        <p className="flex flex-wrap items-center gap-2 text-xl font-bold tabular">
          {heading}
          {isLatest ? <Badge>Latest</Badge> : <Badge variant="secondary">Older report</Badge>}
        </p>
      </div>
      <LiveIndicator status={status} lastUpdated={lastUpdated} />
    </section>
  );
}
