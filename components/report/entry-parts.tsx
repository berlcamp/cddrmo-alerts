import { CircleX, type LucideIcon } from 'lucide-react';
import { valueTone } from '@/lib/labels';
import type { Level, Power, Road } from '@/lib/types';
import { StatusBadge } from './status-badge';

export function ConditionChip({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm font-bold">
      <Icon className="size-4 shrink-0" aria-hidden />
      {label}
    </span>
  );
}

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
