'use client';

import { Check, ChevronDown, CircleAlert, LoaderCircle } from 'lucide-react';
import { useEffect } from 'react';
import { StatusBadge } from '@/components/report/status-badge';
import type { SaveState } from '@/hooks/use-entry-saver';
import { groupByZone } from '@/lib/filter';
import type { ConditionOption, ReportEntry } from '@/lib/types';
import type { EntryPatch } from '@/lib/validation';
import { cn } from '@/lib/utils';
import { EntryEditor } from './entry-editor';

function RowSaveStatus({ state }: { state?: SaveState }) {
  if (!state) return null;
  if (state.state === 'saving') return <span className="flex items-center gap-1 text-xs text-muted-foreground"><LoaderCircle className="size-4 animate-spin" aria-hidden />Saving</span>;
  if (state.state === 'saved') return <span className="flex items-center gap-1 text-xs text-ok"><Check className="size-4" aria-hidden />Saved</span>;
  return <span className="flex items-center gap-1 text-xs font-bold text-danger"><CircleAlert className="size-4" aria-hidden />Not saved</span>;
}

function EntrySummaryLine({ entry, optionLabel }: { entry: ReportEntry; optionLabel: (id: string | null) => string }) {
  if (!entry.responded) return <span className="text-sm font-bold text-danger">No response</span>;
  const issues = [
    entry.road === 'unpassable' && 'Unpassable',
    entry.river === 'above_normal' && 'River above normal',
    entry.monitors_coastal && entry.coastal === 'above_normal' && 'Coast above normal',
    entry.power === 'no_power' && 'No power',
  ].filter((issue): issue is string => Boolean(issue));
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
      <span>{optionLabel(entry.weather_option_id)} · {optionLabel(entry.wind_option_id)}</span>
      {issues.map((issue) => <StatusBadge key={issue} tone="danger" label={issue} />)}
    </span>
  );
}

export function RollCallList({ entries, openId, onToggle, states, optionLabel, flashIds, weatherOptions, windOptions, onPatch, onRetry, onDiscard, onNext }: {
  entries: ReportEntry[];
  openId: string | null;
  onToggle: (id: string) => void;
  states: Record<string, SaveState>;
  optionLabel: (id: string | null) => string;
  flashIds: ReadonlySet<string>;
  weatherOptions: ConditionOption[];
  windOptions: ConditionOption[];
  onPatch: (id: string, patch: EntryPatch) => void;
  onRetry: (id: string) => void;
  onDiscard: (id: string) => void;
  onNext: (id: string) => void;
}) {
  useEffect(() => {
    if (!openId) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(`row-${openId}`)?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
  }, [openId]);

  return (
    <div className="space-y-6">
      {groupByZone(entries).map((group) => (
        <section key={group.zone} aria-label={`${group.zone} barangays`}>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">{group.zone}</h2>
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {group.entries.map((entry) => {
              const open = entry.id === openId;
              return (
                <li key={entry.id} id={`row-${entry.id}`} className={cn('scroll-mt-20', flashIds.has(entry.id) && 'motion-safe:animate-flash')}>
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={`editor-${entry.id}`}
                    onClick={() => onToggle(entry.id)}
                    className={cn('flex min-h-16 w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent', !entry.responded && 'bg-danger-soft/50')}
                  >
                    <span className="w-24 shrink-0 text-lg font-bold sm:w-32">{entry.callsign}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">{entry.barangay_name}</span>
                      <EntrySummaryLine entry={entry} optionLabel={optionLabel} />
                    </span>
                    <RowSaveStatus state={states[entry.id]} />
                    <ChevronDown className={cn('size-5 shrink-0 transition-transform duration-150', open && 'rotate-180')} aria-hidden />
                  </button>
                  {open && (
                    <div id={`editor-${entry.id}`} className="border-t bg-background px-4 py-4">
                      <EntryEditor
                        entry={entry}
                        weatherOptions={weatherOptions}
                        windOptions={windOptions}
                        saveState={states[entry.id]}
                        onPatch={onPatch}
                        onRetry={onRetry}
                        onDiscard={onDiscard}
                        onNext={onNext}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
