import { summarizeReport } from './summary';
import type { ConditionOption, Report, ReportEntry, ReportSummary } from './types';

export const TREND_SIZE = 14;
export const HOTSPOT_LIMIT = 6;

export type IssueKind = 'noResponse' | 'unpassable' | 'river' | 'coastal' | 'noPower';
export const ISSUE_KINDS: IssueKind[] = ['noResponse', 'unpassable', 'river', 'coastal', 'noPower'];

export interface TrendPoint {
  id: string;
  report_at: string;
  active: number;
  total: number;
}

export interface Hotspot {
  barangay_id: string;
  barangay_name: string;
  zone_name: string;
  /** Reports in the window where this barangay had at least one issue. */
  reports: number;
  counts: Record<IssueKind, number>;
}

export interface DashboardStats {
  latest: { report: Report; summary: ReportSummary; issues: { entry: ReportEntry; kinds: IssueKind[] }[] } | null;
  drafts: { report: Report; active: number; total: number }[];
  publishedInWindow: number;
  trend: TrendPoint[];
  averageResponse: number | null;
  hotspots: Hotspot[];
}

/** What to flag for one barangay row; silence from a barangay without a radio is expected, not an issue. */
export function entryIssues(e: ReportEntry): IssueKind[] {
  if (!e.responded) return e.no_radio ? [] : ['noResponse'];
  const kinds: IssueKind[] = [];
  if (e.road === 'unpassable') kinds.push('unpassable');
  if (e.river === 'above_normal') kinds.push('river');
  if (e.monitors_coastal && e.coastal === 'above_normal') kinds.push('coastal');
  if (e.power === 'no_power') kinds.push('noPower');
  return kinds;
}

const emptyCounts = (): Record<IssueKind, number> => ({ noResponse: 0, unpassable: 0, river: 0, coastal: 0, noPower: 0 });

/** Rolls the most recent reports (newest first) up into the admin dashboard's figures. */
export function buildDashboard(rows: { report: Report; entries: ReportEntry[] }[], options: ConditionOption[]): DashboardStats {
  const published = rows.filter((r) => r.report.status === 'published');
  const drafts = rows
    .filter((r) => r.report.status === 'draft')
    .map(({ report, entries }) => ({ report, active: entries.filter((e) => e.responded).length, total: entries.length }));

  const first = published[0];
  const latest = first
    ? {
        report: first.report,
        summary: summarizeReport(first.report, first.entries, options),
        issues: first.entries.map((entry) => ({ entry, kinds: entryIssues(entry) })).filter((i) => i.kinds.length > 0),
      }
    : null;

  const trend = published
    .slice(0, TREND_SIZE)
    .map(({ report, entries }) => ({ id: report.id, report_at: report.report_at, active: entries.filter((e) => e.responded).length, total: entries.length }))
    .reverse();
  const rated = trend.filter((p) => p.total > 0);
  const averageResponse = rated.length > 0 ? rated.reduce((sum, p) => sum + p.active / p.total, 0) / rated.length : null;

  const byBarangay = new Map<string, Hotspot>();
  for (const { entries } of published) {
    for (const e of entries) {
      const kinds = entryIssues(e);
      if (kinds.length === 0) continue;
      const spot = byBarangay.get(e.barangay_id) ?? { barangay_id: e.barangay_id, barangay_name: e.barangay_name, zone_name: e.zone_name, reports: 0, counts: emptyCounts() };
      spot.reports += 1;
      for (const k of kinds) spot.counts[k] += 1;
      byBarangay.set(e.barangay_id, spot);
    }
  }
  const hotspots = [...byBarangay.values()]
    .sort((a, b) => b.reports - a.reports || a.barangay_name.localeCompare(b.barangay_name))
    .slice(0, HOTSPOT_LIMIT);

  return { latest, drafts, publishedInWindow: published.length, trend, averageResponse, hotspots };
}
