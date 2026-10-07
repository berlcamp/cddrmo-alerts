import { CircleCheck, CircleX, Minus, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { Tone } from '@/lib/labels';
import { cn } from '@/lib/utils';

const TONE_CLASS: Record<Tone, string> = {
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  none: 'bg-muted text-muted-foreground',
};

const TONE_ICON: Record<Tone, LucideIcon> = { ok: CircleCheck, warn: TriangleAlert, danger: CircleX, none: Minus };

export function StatusBadge({ tone, label, icon }: { tone: Tone; label: string; icon?: LucideIcon }) {
  const Icon = icon ?? TONE_ICON[tone];
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-sm font-bold', TONE_CLASS[tone])}>
      <Icon className="size-4 shrink-0" aria-hidden />
      {label}
    </span>
  );
}
