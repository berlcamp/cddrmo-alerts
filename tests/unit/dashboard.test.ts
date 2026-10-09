import { describe, expect, it } from 'vitest';
import { buildDashboard, entryIssues } from '@/lib/dashboard';
import type { Report, ReportEntry } from '@/lib/types';
import { makeEntry, OPTIONS, SAMPLE_REPORT } from '../fixtures/sample-sitrep';

const report = (id: string, report_at: string, status: Report['status'] = 'published'): Report => ({ ...SAMPLE_REPORT, id, report_at, status });

describe('entryIssues', () => {
  it('flags silence, closures, high water and outages', () => {
    expect(entryIssues(makeEntry(1, 'A', 'A1', 'Upland'))).toEqual(['noResponse']);
    expect(entryIssues(makeEntry(1, 'A', 'A1', 'Upland', { no_radio: true }))).toEqual([]);
    expect(entryIssues(makeEntry(1, 'A', 'A1', 'Coastal', { responded: true, road: 'unpassable', river: 'above_normal', coastal: 'above_normal', power: 'no_power' })))
      .toEqual(['unpassable', 'river', 'coastal', 'noPower']);
    expect(entryIssues(makeEntry(1, 'A', 'A1', 'Upland', { responded: true, coastal: 'above_normal' }))).toEqual([]);
  });
});

describe('buildDashboard', () => {
  const ok = (no: number): ReportEntry => makeEntry(no, `B${no}`, `C${no}`, 'Upland', { responded: true, road: 'passable' });
  const rows = [
    { report: report('d1', '2026-10-09T04:00:00.000Z', 'draft'), entries: [ok(1), makeEntry(2, 'B2', 'C2', 'Upland')] },
    { report: report('p2', '2026-10-09T00:00:00.000Z'), entries: [ok(1), makeEntry(2, 'B2', 'C2', 'Upland', { responded: true, road: 'unpassable' })] },
    { report: report('p1', '2026-10-08T00:00:00.000Z'), entries: [makeEntry(1, 'B1', 'C1', 'Upland'), makeEntry(2, 'B2', 'C2', 'Upland', { responded: true, power: 'no_power' })] },
  ];

  it('splits drafts from the latest published report', () => {
    const d = buildDashboard(rows, OPTIONS);
    expect(d.drafts.map((x) => [x.report.id, x.active, x.total])).toEqual([['d1', 1, 2]]);
    expect(d.latest?.report.id).toBe('p2');
    expect(d.latest?.issues.map((i) => [i.entry.barangay_name, i.kinds])).toEqual([['B2', ['unpassable']]]);
    expect(d.publishedInWindow).toBe(2);
  });

  it('orders the trend oldest first and averages the response rate', () => {
    const d = buildDashboard(rows, OPTIONS);
    expect(d.trend.map((p) => [p.id, p.active, p.total])).toEqual([['p1', 1, 2], ['p2', 2, 2]]);
    expect(d.averageResponse).toBeCloseTo(0.75);
  });

  it('ranks barangays by how many published reports flagged them', () => {
    const d = buildDashboard(rows, OPTIONS);
    expect(d.hotspots.map((h) => [h.barangay_name, h.reports])).toEqual([['B2', 2], ['B1', 1]]);
    expect(d.hotspots[0].counts).toMatchObject({ unpassable: 1, noPower: 1, noResponse: 0 });
  });

  it('handles an empty window', () => {
    const d = buildDashboard([], OPTIONS);
    expect(d.latest).toBeNull();
    expect(d.averageResponse).toBeNull();
    expect(d.trend).toEqual([]);
  });
});
