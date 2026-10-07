import { Anchor, CloudRain, Route, Waves, Wind, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import { summaryTone } from '@/lib/labels';
import type { ReportSummary } from '@/lib/types';
import { cn } from '@/lib/utils';
import { StatusBadge } from './status-badge';

function Tile({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border bg-card p-4 text-card-foreground', className)}>
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function ProgressRing({ value }: { value: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 44 44" className="size-11 -rotate-90" aria-hidden>
      <circle cx="22" cy="22" r={r} fill="none" strokeWidth="5" className="stroke-muted" />
      <circle
        cx="22" cy="22" r={r} fill="none" strokeWidth="5" strokeLinecap="round"
        className="stroke-ok transition-[stroke-dashoffset] duration-300 motion-reduce:transition-none"
        strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)}
      />
    </svg>
  );
}

export function SummaryTiles({ summary }: { summary: ReportSummary }) {
  const pct = summary.total ? Math.round((summary.active / summary.total) * 100) : 0;
  return (
    <section aria-label="Summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile label="Active stations">
        <div className="flex items-center gap-3">
          <ProgressRing value={pct} />
          <p className="text-3xl font-bold tabular">
            {summary.active}
            <span className="text-lg text-muted-foreground"> / {summary.total}</span>
          </p>
        </div>
      </Tile>
      <Tile label="No response">
        <p className={cn('text-3xl font-bold tabular', summary.noResponse > 0 && 'text-danger')}>{summary.noResponse}</p>
      </Tile>
      <Tile label="Average weather">
        <p className="flex items-center gap-2 text-lg font-bold"><CloudRain className="size-5 shrink-0" aria-hidden />{summary.weather}</p>
      </Tile>
      <Tile label="Average wind">
        <p className="flex items-center gap-2 text-lg font-bold"><Wind className="size-5 shrink-0" aria-hidden />{summary.wind}</p>
      </Tile>
      <Tile label="Rivers / canals"><StatusBadge tone={summaryTone(summary.rivers)} label={summary.rivers} icon={Waves} /></Tile>
      <Tile label="Roads / bridges"><StatusBadge tone={summaryTone(summary.roads)} label={summary.roads} icon={Route} /></Tile>
      <Tile label="Coastal"><StatusBadge tone={summaryTone(summary.coastal)} label={summary.coastal} icon={Anchor} /></Tile>
      <Tile label="Power"><StatusBadge tone={summaryTone(summary.power)} label={summary.power} icon={Zap} /></Tile>
    </section>
  );
}
