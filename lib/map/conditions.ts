// isomorphic: colour scale shared by the map markers, the legend and the table.
import type { ConditionKind, ConditionOption } from '@/lib/types';

export interface Swatch {
  bg: string;
  fg: string;
  border: string;
}

export interface ConditionLook extends Swatch {
  kind: ConditionKind;
  label: string;
  /** Position on the kind's scale: 0..WEATHER_SCALE.length-1 or 0..WIND_SCALE.length-1. */
  level: number;
}

// Calm → severe. Each fill keeps at least 3:1 contrast with its icon colour.
export const WEATHER_SCALE: Swatch[] = [
  { bg: '#fbbf24', fg: '#422006', border: '#b45309' }, // sunny
  { bg: '#64748b', fg: '#ffffff', border: '#334155' }, // cloudy
  { bg: '#0284c7', fg: '#ffffff', border: '#075985' }, // light rain
  { bg: '#1d4ed8', fg: '#ffffff', border: '#1e3a8a' }, // moderate rain
  { bg: '#6d28d9', fg: '#ffffff', border: '#4c1d95' }, // heavy rain
  { bg: '#b91c1c', fg: '#ffffff', border: '#7f1d1d' }, // torrential rain
];

export const WIND_SCALE: Swatch[] = [
  { bg: '#ffffff', fg: '#475569', border: '#94a3b8' }, // not windy
  { bg: '#0d9488', fg: '#ffffff', border: '#115e59' }, // light
  { bg: '#ea580c', fg: '#ffffff', border: '#9a3412' }, // moderate
  { bg: '#b91c1c', fg: '#ffffff', border: '#7f1d1d' }, // strong
];

export const NO_RESPONSE_SWATCH: Swatch = { bg: '#ffffff', fg: '#b91c1c', border: '#b91c1c' };

const SCALES: Record<ConditionKind, Swatch[]> = { weather: WEATHER_SCALE, wind: WIND_SCALE };

/** Maps an option's severity onto its kind's colour scale, relative to the most severe option of that kind. */
export function scaleLevel(severity: number, maxSeverity: number, steps: number): number {
  if (maxSeverity <= 0 || steps <= 1) return 0;
  const level = Math.round((Math.max(0, Math.min(severity, maxSeverity)) / maxSeverity) * (steps - 1));
  return Math.max(0, Math.min(level, steps - 1));
}

export function makeConditionLooker(options: ConditionOption[]): (id: string | null) => ConditionLook | null {
  const maxSeverity: Record<ConditionKind, number> = { weather: 0, wind: 0 };
  for (const o of options) maxSeverity[o.kind] = Math.max(maxSeverity[o.kind], o.severity);
  const looks = new Map<string, ConditionLook>(
    options.map((o) => {
      const scale = SCALES[o.kind];
      const level = scaleLevel(o.severity, maxSeverity[o.kind], scale.length);
      return [o.id, { kind: o.kind, label: o.label, level, ...scale[level] }];
    }),
  );
  return (id) => (id ? looks.get(id) ?? null : null);
}
