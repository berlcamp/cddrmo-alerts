import { NONE } from './summary';
import type { ConditionOption, Level, Power, Road } from './types';

export type Tone = 'ok' | 'warn' | 'danger' | 'none';

export const ROAD_LABEL: Record<Road, string> = { passable: 'Passable', unpassable: 'Unpassable' };
export const LEVEL_LABEL: Record<Level, string> = { normal: 'Normal', above_normal: 'Above normal' };
export const POWER_LABEL: Record<Power, string> = { with_power: 'With power', no_power: 'No power' };

export function valueTone(value: Road | Level | Power | null): Tone {
  switch (value) {
    case 'passable':
    case 'normal':
    case 'with_power':
      return 'ok';
    case 'above_normal':
      return 'warn';
    case 'unpassable':
    case 'no_power':
      return 'danger';
    default:
      return 'none';
  }
}

export function summaryTone(text: string): Tone {
  const t = text.trim().toUpperCase();
  if (t === '' || t === NONE) return 'none';
  if (t.startsWith('ABOVE NORMAL')) return 'warn';
  if (t.startsWith('UNPASSABLE') || t.startsWith('NO POWER')) return 'danger';
  return 'ok';
}

export function makeOptionLabeler(options: ConditionOption[]): (id: string | null) => string {
  const labels = new Map(options.map((o) => [o.id, o.label]));
  return (id) => (id ? labels.get(id) ?? NONE : NONE);
}
