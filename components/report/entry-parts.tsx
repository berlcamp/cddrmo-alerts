import { CircleX, RadioOff, type LucideIcon } from 'lucide-react';
import { valueTone } from '@/lib/labels';
import { NO_RADIO_REMARK } from '@/lib/summary';
import type { Level, Power, ReportEntry, Road } from '@/lib/types';
import { cn } from '@/lib/utils';
import { StatusBadge } from './status-badge';

export function StatusItem({ label, icon, value, text }: { label: string; icon?: LucideIcon; value: Road | Level | Power | null; text: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd><StatusBadge tone={valueTone(value)} label={text} icon={value ? icon : undefined} /></dd>
    </div>
  );
}

export function NoResponseLabel() {
  return (
    <span className="inline-flex items-center gap-1.5 font-bold text-danger">
      <CircleX className="size-5 shrink-0" aria-hidden />
      No response
    </span>
  );
}

/** Barangay remarks, led by the automatic "No radio capability" note when the barangay has no radio. */
export function EntryRemarks({ entry, className }: { entry: Pick<ReportEntry, 'no_radio' | 'remarks'>; className?: string }) {
  const remarks = entry.remarks?.trim();
  if (!entry.no_radio && !remarks) return null;
  return (
    <div className={cn('space-y-0.5', className)}>
      {entry.no_radio && (
        <p className="flex items-center gap-1 font-bold">
          <RadioOff className="size-3.5 shrink-0" aria-hidden />
          {NO_RADIO_REMARK}
        </p>
      )}
      {remarks && <p>{remarks}</p>}
    </div>
  );
}
