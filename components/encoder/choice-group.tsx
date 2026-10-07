'use client';

import { Check } from 'lucide-react';
import { useId } from 'react';
import { cn } from '@/lib/utils';

type ChoiceTone = 'neutral' | 'ok' | 'warn' | 'danger';

const SELECTED: Record<ChoiceTone, string> = {
  neutral: 'border-primary bg-primary text-primary-foreground',
  ok: 'border-ok bg-ok text-on-status',
  warn: 'border-warn bg-warn text-on-status',
  danger: 'border-danger bg-danger text-on-status',
};

export function ChoiceGroup<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T | null;
  options: { value: T; label: string; tone?: ChoiceTone }[];
  onChange: (value: T | null) => void;
}) {
  const labelId = useId();
  return (
    <div role="group" aria-labelledby={labelId}>
      <p id={labelId} className="mb-2 text-sm font-bold">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(selected ? null : option.value)}
              className={cn(
                'inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-full border px-4 text-sm font-bold transition-colors duration-150',
                selected ? SELECTED[option.tone ?? 'neutral'] : 'bg-card hover:bg-accent',
              )}
            >
              {selected && <Check className="size-4" aria-hidden />}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
