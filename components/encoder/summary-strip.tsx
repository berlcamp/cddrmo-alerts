import { StatusBadge } from '@/components/report/status-badge';
import { summaryTone } from '@/lib/labels';
import type { ReportSummary } from '@/lib/types';
import { cn } from '@/lib/utils';

export function SummaryStrip({ summary }: { summary: ReportSummary }) {
  return (
    <div className="sticky top-0 z-20 -mx-4 border-b bg-background/95 px-4 py-2 backdrop-blur">
      <ul aria-label="Live summary" className="flex flex-wrap gap-2 text-sm font-bold">
        <li className="rounded-full bg-ok-soft px-3 py-1 tabular text-ok">{summary.active}/{summary.total} active</li>
        <li className={cn('rounded-full px-3 py-1 tabular', summary.noResponse > 0 ? 'bg-danger-soft text-danger' : 'bg-muted')}>
          {summary.noResponse} no response
        </li>
        <li className="rounded-full bg-muted px-3 py-1">{summary.weather}</li>
        <li className="rounded-full bg-muted px-3 py-1">{summary.wind}</li>
        <li><StatusBadge tone={summaryTone(summary.roads)} label={`Roads: ${summary.roads}`} /></li>
        <li><StatusBadge tone={summaryTone(summary.rivers)} label={`Rivers: ${summary.rivers}`} /></li>
        <li><StatusBadge tone={summaryTone(summary.coastal)} label={`Coastal: ${summary.coastal}`} /></li>
        <li><StatusBadge tone={summaryTone(summary.power)} label={`Power: ${summary.power}`} /></li>
      </ul>
    </div>
  );
}
