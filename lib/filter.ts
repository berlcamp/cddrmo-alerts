import { entryHasIssue } from './summary';
import type { ReportEntry } from './types';

export function filterEntries(entries: ReportEntry[], zone: string, issuesOnly: boolean): ReportEntry[] {
  return entries.filter((e) => (zone === 'all' || e.zone_name === zone) && (!issuesOnly || entryHasIssue(e)));
}

export function groupByZone(entries: ReportEntry[]): { zone: string; entries: ReportEntry[] }[] {
  const groups: { zone: string; entries: ReportEntry[] }[] = [];
  for (const entry of entries) {
    const last = groups[groups.length - 1];
    if (last && last.zone === entry.zone_name) last.entries.push(entry);
    else groups.push({ zone: entry.zone_name, entries: [entry] });
  }
  return groups;
}

export function zoneNames(entries: ReportEntry[]): string[] {
  return [...new Set(entries.map((e) => e.zone_name))];
}
