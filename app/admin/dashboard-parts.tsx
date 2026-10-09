import Link from 'next/link';
import { Bridge, CircleX, Waves, WavesArrowUp, ZapOff, type LucideIcon } from 'lucide-react';
import type { IssueKind, TrendPoint } from '@/lib/dashboard';
import { formatShortHeading } from '@/lib/format';
import type { Tone } from '@/lib/labels';
import { StatusBadge } from '@/components/report/status-badge';
import { cn } from '@/lib/utils';

export const ISSUE_META: Record<IssueKind, { label: string; icon: LucideIcon; tone: Tone }> = {
  noResponse: { label: 'No response', icon: CircleX, tone: 'danger' },
  unpassable: { label: 'Road unpassable', icon: Bridge, tone: 'danger' },
  river: { label: 'River above normal', icon: Waves, tone: 'warn' },
  coastal: { label: 'Coastal above normal', icon: WavesArrowUp, tone: 'warn' },
  noPower: { label: 'No power', icon: ZapOff, tone: 'danger' },
};

export function IssueBadge({ kind, count }: { kind: IssueKind; count?: number }) {
  const meta = ISSUE_META[kind];
  return <StatusBadge tone={meta.tone} icon={meta.icon} label={count === undefined ? meta.label : `${meta.label} ×${count}`} />;
}

export function Panel({ title, action, className, children }: { title: string; action?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn('flex flex-col rounded-xl border bg-card', className)} aria-label={title}>
      <div className="flex min-h-14 items-center justify-between gap-3 border-b px-4 py-2">
        <h2 className="text-lg font-bold">{title}</h2>
        {action}
      </div>
      <div className="flex-1 p-4">{children}</div>
    </section>
  );
}

export function StatTile({ label, value, hint, icon: Icon, tone = 'none' }: { label: string; value: string; hint: string; icon: LucideIcon; tone?: Tone }) {
  const iconClass: Record<Tone, string> = { ok: 'bg-ok-soft text-ok', warn: 'bg-warn-soft text-warn', danger: 'bg-danger-soft text-danger', none: 'bg-muted text-foreground' };
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-card p-4">
      <span className={cn('inline-flex size-10 shrink-0 items-center justify-center rounded-lg', iconClass[tone])}>
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-muted-foreground">{label}</p>
        <p className="text-3xl font-bold leading-tight tabular">{value}</p>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

export function ResponseMeter({ active, total }: { active: number; total: number }) {
  const pct = total > 0 ? Math.round((active / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-bold tabular">{active}/{total} stations responded</span>
        <span className="text-sm font-bold tabular text-muted-foreground">{pct}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Response rate">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Response rate per published report, oldest to newest; each bar links to its report and carries a hover tooltip. */
export function ResponseTrend({ points }: { points: TrendPoint[] }) {
  if (points.length === 0) return <p className="text-muted-foreground">No published reports yet.</p>;
  return (
    <figure className="space-y-2">
      <div className="relative flex h-48 gap-3 pl-10">
        <div aria-hidden className="pointer-events-none absolute inset-0 left-10">
          {[100, 50, 0].map((t) => (
            <div key={t} className="absolute inset-x-0 border-t border-border" style={{ bottom: `${t}%` }}>
              <span className="absolute -left-10 -translate-y-1/2 text-xs tabular text-muted-foreground">{t}%</span>
            </div>
          ))}
        </div>
        <ol className="relative flex flex-1 items-end gap-0.5">
          {points.map((p) => {
            const pct = p.total > 0 ? Math.round((p.active / p.total) * 100) : 0;
            const label = `${formatShortHeading(p.report_at)}: ${p.active}/${p.total} responded (${pct}%)`;
            return (
              <li key={p.id} className="group relative flex h-full min-w-0 flex-1 items-end">
                <Link href={`/admin/reports/${p.id}`} aria-label={label} className="flex h-full w-full items-end rounded-sm px-[1px] focus-visible:outline-2 focus-visible:outline-ring">
                  <span className="block w-full max-w-10 mx-auto rounded-t-[4px] bg-primary transition-opacity group-hover:opacity-80" style={{ height: `${Math.max(pct, 1)}%` }} />
                </Link>
                <span
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-brand px-2 py-1 text-xs font-bold text-brand-foreground shadow group-hover:block group-focus-within:block"
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <figcaption className="flex justify-between pl-10 text-xs tabular text-muted-foreground">
        <span>{formatShortHeading(points[0].report_at)}</span>
        {points.length > 1 && <span>{formatShortHeading(points[points.length - 1].report_at)}</span>}
      </figcaption>
    </figure>
  );
}
