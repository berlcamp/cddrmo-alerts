import type { ConditionOption, Level, Power, Report, ReportEntry, ReportSummary, Road } from './types';

export const NONE = '—';
export const SHARE_THRESHOLD = 0.2;

export type SummaryOverrides = Pick<
  Report,
  'weather_summary_override' | 'wind_summary_override' | 'rivers_summary_override' | 'roads_summary_override' | 'coastal_summary_override'
>;

export function joinRange(low: string, high: string): string {
  const a = low.trim().split(/\s+/);
  const b = high.trim().split(/\s+/);
  if (a.length > 1 && b.length > 1 && a[a.length - 1].toLowerCase() === b[b.length - 1].toLowerCase()) {
    return `${a.slice(0, -1).join(' ')} to ${high}`;
  }
  return `${low} to ${high}`;
}

const bySeverity = (x: ConditionOption, y: ConditionOption) => x.severity - y.severity || x.sort_order - y.sort_order;

export function summarizeCondition(optionIds: (string | null)[], options: ConditionOption[]): string {
  const byId = new Map(options.map((o) => [o.id, o]));
  const counts = new Map<string, number>();
  let total = 0;
  for (const id of optionIds) {
    if (!id || !byId.has(id)) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
    total += 1;
  }
  if (total === 0) return NONE;
  const reported = [...counts.keys()].map((id) => byId.get(id)!).sort(bySeverity);
  const significant = reported.filter((o) => counts.get(o.id)! / total >= SHARE_THRESHOLD);
  const pool = significant.length > 0 ? significant : reported;
  const low = pool[0];
  const high = pool[pool.length - 1];
  return low.id === high.id ? low.label : joinRange(low.label, high.label);
}

function countOf<T>(values: T[], target: T): number {
  return values.filter((v) => v === target).length;
}

function levelSummary(values: (Level | null)[]): string {
  const above = countOf(values, 'above_normal');
  if (above > 0) return `ABOVE NORMAL (${above})`;
  return values.includes('normal') ? 'NORMAL' : NONE;
}

function roadSummary(values: (Road | null)[]): string {
  const closed = countOf(values, 'unpassable');
  if (closed > 0) return `UNPASSABLE (${closed})`;
  return values.includes('passable') ? 'PASSABLE' : NONE;
}

function powerSummary(values: (Power | null)[]): string {
  const out = countOf(values, 'no_power');
  if (out > 0) return `NO POWER (${out})`;
  return values.includes('with_power') ? 'WITH POWER' : NONE;
}

function pick(override: string | null, computed: string): string {
  const text = override?.trim();
  return text ? text : computed;
}

export function entryHasIssue(e: ReportEntry): boolean {
  return (
    !e.responded ||
    e.road === 'unpassable' ||
    e.river === 'above_normal' ||
    (e.monitors_coastal && e.coastal === 'above_normal') ||
    e.power === 'no_power'
  );
}

export function summarizeReport(report: SummaryOverrides, entries: ReportEntry[], options: ConditionOption[]): ReportSummary {
  const responded = entries.filter((e) => e.responded);
  const coastal = responded.filter((e) => e.monitors_coastal);
  return {
    total: entries.length,
    active: responded.length,
    noResponse: entries.length - responded.length,
    weather: pick(report.weather_summary_override, summarizeCondition(responded.map((e) => e.weather_option_id), options)),
    wind: pick(report.wind_summary_override, summarizeCondition(responded.map((e) => e.wind_option_id), options)),
    rivers: pick(report.rivers_summary_override, levelSummary(responded.map((e) => e.river))),
    roads: pick(report.roads_summary_override, roadSummary(responded.map((e) => e.road))),
    coastal: pick(report.coastal_summary_override, levelSummary(coastal.map((e) => e.coastal))),
    power: powerSummary(responded.map((e) => e.power)),
    hasIssues: responded.some(entryHasIssue),
  };
}

export function describeSummary(s: ReportSummary): string {
  return [
    `${s.active}/${s.total} stations active`,
    s.weather,
    s.wind,
    `Roads ${s.roads.toLowerCase()}`,
    `Rivers ${s.rivers.toLowerCase()}`,
  ].join(' · ');
}

export const NO_RADIO_REMARK = 'No radio capability';

/** An entry's remarks, always led by the "No radio capability" note when flagged, for plain-text outputs. */
export function entryRemarks(entry: Pick<ReportEntry, 'no_radio' | 'remarks'>): string {
  const remarks = entry.remarks?.trim() ?? '';
  if (!entry.no_radio) return remarks;
  return remarks ? `${NO_RADIO_REMARK} · ${remarks}` : NO_RADIO_REMARK;
}
