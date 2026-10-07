'use client';

import { ArrowRight, CircleCheck, CircleX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SaveState } from '@/hooks/use-entry-saver';
import { allNormalPatch, conditionPatch, noResponsePatch, remarksPatch } from '@/lib/encoder-patches';
import type { ConditionOption, Level, Power, ReportEntry, Road } from '@/lib/types';
import type { EntryPatch } from '@/lib/validation';
import { BlurInput } from './blur-input';
import { ChoiceGroup } from './choice-group';

const ROAD = [
  { value: 'passable' as Road, label: 'Passable', tone: 'ok' as const },
  { value: 'unpassable' as Road, label: 'Unpassable', tone: 'danger' as const },
];
const LEVEL = [
  { value: 'normal' as Level, label: 'Normal', tone: 'ok' as const },
  { value: 'above_normal' as Level, label: 'Above normal', tone: 'warn' as const },
];
const POWER = [
  { value: 'with_power' as Power, label: 'With power', tone: 'ok' as const },
  { value: 'no_power' as Power, label: 'No power', tone: 'danger' as const },
];

export function EntryEditor({ entry, weatherOptions, windOptions, saveState, onPatch, onRetry, onDiscard, onNext }: {
  entry: ReportEntry;
  weatherOptions: ConditionOption[];
  windOptions: ConditionOption[];
  saveState?: SaveState;
  onPatch: (id: string, patch: EntryPatch) => void;
  onRetry: (id: string) => void;
  onDiscard: (id: string) => void;
  onNext: (id: string) => void;
}) {
  const patch = (p: EntryPatch) => onPatch(entry.id, p);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => patch(allNormalPatch(entry))} className="h-11 cursor-pointer bg-ok text-on-status hover:bg-ok/90">
          <CircleCheck aria-hidden /> Responded – all normal
        </Button>
        <Button type="button" variant="outline" onClick={() => patch(noResponsePatch())} className="h-11 cursor-pointer border-danger text-danger hover:bg-danger-soft">
          <CircleX aria-hidden /> No response
        </Button>
      </div>
      <ChoiceGroup
        label="Weather"
        value={entry.weather_option_id}
        options={weatherOptions.map((o) => ({ value: o.id, label: o.label }))}
        onChange={(v) => patch(conditionPatch('weather_option_id', v))}
      />
      <ChoiceGroup
        label="Wind"
        value={entry.wind_option_id}
        options={windOptions.map((o) => ({ value: o.id, label: o.label }))}
        onChange={(v) => patch(conditionPatch('wind_option_id', v))}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <ChoiceGroup label="Road" value={entry.road} options={ROAD} onChange={(v) => patch(conditionPatch('road', v))} />
        <ChoiceGroup label="River / canal" value={entry.river} options={LEVEL} onChange={(v) => patch(conditionPatch('river', v))} />
        {entry.monitors_coastal && (
          <ChoiceGroup label="Coastal" value={entry.coastal} options={LEVEL} onChange={(v) => patch(conditionPatch('coastal', v))} />
        )}
        <ChoiceGroup label="Power" value={entry.power} options={POWER} onChange={(v) => patch(conditionPatch('power', v))} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`remarks-${entry.id}`} className="text-sm font-bold">Remarks</label>
        <BlurInput id={`remarks-${entry.id}`} value={entry.remarks} onCommit={(text) => patch(remarksPatch(text))} placeholder="Optional" />
      </div>
      {saveState?.state === 'failed' && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-md bg-danger-soft px-3 py-2 text-danger">
          <span className="font-bold">Not saved:</span> {saveState.message}
          <Button type="button" size="sm" variant="outline" className="cursor-pointer" onClick={() => onRetry(entry.id)}>Retry now</Button>
          <Button type="button" size="sm" variant="ghost" className="cursor-pointer" onClick={() => onDiscard(entry.id)}>Discard change</Button>
        </div>
      )}
      <div className="flex justify-end">
        <Button type="button" onClick={() => onNext(entry.id)} className="h-11 cursor-pointer">
          Next barangay <ArrowRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}
