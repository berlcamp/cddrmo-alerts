import type { Level, Power, ReportEntry, Road } from './types';
import type { EntryPatch } from './validation';

type ConditionField = 'weather_option_id' | 'wind_option_id' | 'road' | 'river' | 'coastal' | 'power';
type ConditionValue = string | Road | Level | Power | null;

export function allNormalPatch(entry: Pick<ReportEntry, 'monitors_coastal'>): EntryPatch {
  return {
    responded: true,
    road: 'passable',
    river: 'normal',
    coastal: entry.monitors_coastal ? 'normal' : null,
    power: 'with_power',
  };
}

export function noResponsePatch(): EntryPatch {
  return { responded: false, weather_option_id: null, wind_option_id: null, road: null, river: null, coastal: null, power: null };
}

export function conditionPatch(field: ConditionField, value: ConditionValue): EntryPatch {
  return { [field]: value, responded: true } as EntryPatch;
}

export function remarksPatch(text: string): EntryPatch {
  const trimmed = text.trim();
  return { remarks: trimmed === '' ? null : trimmed };
}

export function applyPatch(entry: ReportEntry, patch: EntryPatch | undefined): ReportEntry {
  return patch ? ({ ...entry, ...patch } as ReportEntry) : entry;
}

export function mergePatch(a: EntryPatch | undefined, b: EntryPatch): EntryPatch {
  return { ...a, ...b };
}

export function omitKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}
