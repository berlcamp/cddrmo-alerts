'use client';

import { Check, CircleAlert, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SaveState } from '@/hooks/use-entry-saver';
import { allNormalPatch, conditionPatch, noResponsePatch, remarksPatch } from '@/lib/encoder-patches';
import { groupByZone } from '@/lib/filter';
import type { ConditionOption, Level, Power, ReportEntry, Road } from '@/lib/types';
import type { EntryPatch } from '@/lib/validation';
import { cn } from '@/lib/utils';
import { BlurInput } from './blur-input';

type Tone = 'ok' | 'warn' | 'danger';

const SELECTED: Record<Tone, string> = {
  ok: 'border-ok bg-ok text-on-status',
  warn: 'border-warn bg-warn text-on-status',
  danger: 'border-danger bg-danger text-on-status',
};

// Compact on mouse/trackpad, full 44px targets on touch screens.
const CONTROL = 'h-9 pointer-coarse:h-11';

const ROAD = [
  { value: 'passable' as Road, label: 'Passable', tone: 'ok' as const },
  { value: 'unpassable' as Road, label: 'Unpassable', tone: 'danger' as const },
];
const LEVEL = [
  { value: 'normal' as Level, label: 'Normal', tone: 'ok' as const },
  { value: 'above_normal' as Level, label: 'Above', full: 'Above normal', tone: 'warn' as const },
];
const POWER = [
  { value: 'with_power' as Power, label: 'On', full: 'With power', tone: 'ok' as const },
  { value: 'no_power' as Power, label: 'Off', full: 'No power', tone: 'danger' as const },
];

function Segmented<T extends string>({ label, value, options, onChange, dim }: {
  label: string;
  value: T | null;
  options: { value: T; label: string; full?: string; tone: Tone }[];
  onChange: (value: T | null) => void;
  dim?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className={cn('inline-flex overflow-hidden rounded-md border', dim && 'opacity-60')}>
      {options.map((option, i) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            aria-label={option.full}
            title={option.full ?? option.label}
            onClick={() => onChange(selected ? null : option.value)}
            className={cn(
              CONTROL,
              'cursor-pointer px-2.5 text-xs font-bold whitespace-nowrap transition-colors duration-150 focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring',
              i > 0 && 'border-l',
              selected ? SELECTED[option.tone] : 'bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function OptionSelect({ label, value, options, onChange, dim, className }: {
  label: string;
  className?: string;
  value: string | null;
  options: ConditionOption[];
  onChange: (value: string | null) => void;
  dim?: boolean;
}) {
  return (
    <select
      aria-label={label}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className={cn(
        CONTROL,
        'w-full cursor-pointer rounded-md border border-input bg-card px-2 text-base md:text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        !value && 'text-muted-foreground',
        dim && 'opacity-60',
        className,
      )}
    >
      <option value="">—</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>{o.label}</option>
      ))}
    </select>
  );
}

function SaveIcon({ state }: { state?: SaveState }) {
  if (!state) return null;
  if (state.state === 'saving') return <LoaderCircle className="size-4 animate-spin text-muted-foreground" aria-label="Saving" />;
  if (state.state === 'saved') return <Check className="size-4 text-ok" aria-label="Saved" />;
  return <CircleAlert className="size-4 text-danger" aria-label="Not saved" />;
}

const COLUMNS = ['Barangay', 'Responded', 'Weather', 'Wind', 'Road', 'River / canal', 'Coastal', 'Power', 'Remarks'];

export function RollCallTable({ entries, states, flashIds, weatherOptions, windOptions, onPatch, onRetry, onDiscard }: {
  entries: ReportEntry[];
  states: Record<string, SaveState>;
  flashIds: ReadonlySet<string>;
  weatherOptions: ConditionOption[];
  windOptions: ConditionOption[];
  onPatch: (id: string, patch: EntryPatch) => void;
  onRetry: (id: string) => void;
  onDiscard: (id: string) => void;
}) {
  const focusRemarks = (index: number) => document.querySelector<HTMLInputElement>(`[data-remarks-index="${index}"]`)?.focus();
  let index = 0;

  return (
    // Breaks out of the page's max-w-6xl column (up to 80rem) so every column fits on a laptop screen.
    <section aria-labelledby="rollcall-heading" className="mx-[calc((100%-min(100vw-2rem,80rem))/2)] space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="rollcall-heading" className="text-lg font-bold">Roll call</h2>
        <p className="text-sm text-muted-foreground">Changes save automatically. Click a selected option again to clear it.</p>
      </div>
      <div className="relative overflow-x-auto rounded-xl border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-muted text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <tr>
              {COLUMNS.map((col, i) => (
                <th key={col} scope="col" className={cn('px-2 py-2 whitespace-nowrap', i === 0 && 'sticky left-0 z-10 bg-muted pl-3')}>{col}</th>
              ))}
              <th scope="col" className="w-8 px-2 py-2"><span className="sr-only">Save status</span></th>
            </tr>
          </thead>
          {groupByZone(entries).map((group) => (
            <tbody key={group.zone}>
              <tr className="border-t bg-muted/30">
                <th scope="colgroup" colSpan={COLUMNS.length + 1} className="px-3 py-1.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <span className="sticky left-3">{group.zone}</span>
                </th>
              </tr>
              {group.entries.map((entry) => {
                const rowIndex = index++;
                const state = states[entry.id];
                const missing = !entry.responded;
                const patch = (p: EntryPatch) => onPatch(entry.id, p);
                const name = `${entry.barangay_name} (${entry.callsign})`;
                return [
                  <tr
                    key={entry.id}
                    className={cn('border-t align-middle', missing && 'bg-danger-soft/50', flashIds.has(entry.id) && 'motion-safe:animate-flash')}
                  >
                    <th scope="row" className={cn('sticky left-0 z-10 py-1.5 pr-2 pl-3 text-left font-normal', missing ? 'bg-danger-soft' : 'bg-card')}>
                      <span className="block font-bold whitespace-nowrap">{entry.barangay_name}</span>
                      <span className="block text-xs whitespace-nowrap text-muted-foreground">
                        {entry.callsign}
                        {entry.no_radio && <> · <span className="font-bold">No radio capability</span></>}
                      </span>
                    </th>
                    <td className="px-1.5 py-1.5">
                      <div role="group" aria-label={`Responded – ${name}`} className="inline-flex overflow-hidden rounded-md border">
                        <button
                          type="button"
                          aria-pressed={!missing}
                          title="Responded – fills in all normal"
                          onClick={() => missing && patch(allNormalPatch(entry))}
                          className={cn(CONTROL, 'cursor-pointer px-2.5 text-xs font-bold transition-colors duration-150', !missing ? SELECTED.ok : 'bg-card text-muted-foreground hover:bg-accent hover:text-foreground')}
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          aria-pressed={missing}
                          title="No response – clears this row"
                          onClick={() => !missing && patch(noResponsePatch())}
                          className={cn(CONTROL, 'cursor-pointer border-l px-2.5 text-xs font-bold transition-colors duration-150', missing ? SELECTED.danger : 'bg-card text-muted-foreground hover:bg-accent hover:text-foreground')}
                        >
                          No
                        </button>
                      </div>
                    </td>
                    <td className="px-1.5 py-1.5">
                      <OptionSelect label={`Weather – ${name}`} value={entry.weather_option_id} options={weatherOptions} dim={missing} className="min-w-36" onChange={(v) => patch(conditionPatch('weather_option_id', v))} />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <OptionSelect label={`Wind – ${name}`} value={entry.wind_option_id} options={windOptions} dim={missing} className="min-w-28" onChange={(v) => patch(conditionPatch('wind_option_id', v))} />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <Segmented label={`Road – ${name}`} value={entry.road} options={ROAD} dim={missing} onChange={(v) => patch(conditionPatch('road', v))} />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <Segmented label={`River / canal – ${name}`} value={entry.river} options={LEVEL} dim={missing} onChange={(v) => patch(conditionPatch('river', v))} />
                    </td>
                    <td className="px-1.5 py-1.5">
                      {entry.monitors_coastal ? (
                        <Segmented label={`Coastal – ${name}`} value={entry.coastal} options={LEVEL} dim={missing} onChange={(v) => patch(conditionPatch('coastal', v))} />
                      ) : (
                        <span className="text-muted-foreground" title="Not a coastal barangay">
                          —<span className="sr-only">Not a coastal barangay</span>
                        </span>
                      )}
                    </td>
                    <td className="px-1.5 py-1.5">
                      <Segmented label={`Power – ${name}`} value={entry.power} options={POWER} dim={missing} onChange={(v) => patch(conditionPatch('power', v))} />
                    </td>
                    <td className="min-w-36 px-1.5 py-1.5">
                      <BlurInput
                        aria-label={`Remarks – ${name}`}
                        data-remarks-index={rowIndex}
                        value={entry.remarks}
                        onCommit={(text) => patch(remarksPatch(text))}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
                          event.preventDefault();
                          event.currentTarget.blur(); // commits the remark
                          focusRemarks(rowIndex + 1);
                        }}
                        enterKeyHint="next"
                        placeholder="Optional"
                        className={cn(CONTROL, 'bg-card md:text-sm')}
                      />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <span className="flex size-4 items-center justify-center"><SaveIcon state={state} /></span>
                    </td>
                  </tr>,
                  state?.state === 'failed' && (
                    <tr key={`${entry.id}-error`} className="bg-danger-soft">
                      <td colSpan={COLUMNS.length + 1} className="px-3 py-2">
                        <div role="alert" className="flex flex-wrap items-center gap-2 text-danger">
                          <span><span className="font-bold">{entry.barangay_name} not saved:</span> {state.message}</span>
                          <Button type="button" variant="outline" size="sm" className={cn(CONTROL, 'cursor-pointer')} onClick={() => onRetry(entry.id)}>Retry now</Button>
                          <Button type="button" variant="ghost" size="sm" className={cn(CONTROL, 'cursor-pointer')} onClick={() => onDiscard(entry.id)}>Discard change</Button>
                        </div>
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          ))}
        </table>
      </div>
    </section>
  );
}
