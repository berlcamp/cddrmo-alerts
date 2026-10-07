import { describe, expect, it } from 'vitest';
import { initLiveState, lastUpdatedAt, liveReducer, sortEntries } from '@/lib/live/report-state';
import type { ReportEntry } from '@/lib/types';
import { makeEntry, SAMPLE_ENTRIES, SAMPLE_REPORT } from '../fixtures/sample-sitrep';

const AFTER = Date.parse('2026-10-07T05:00:00.000Z');
const base = () => initLiveState({ report: SAMPLE_REPORT, entries: [...SAMPLE_ENTRIES].reverse() });

describe('liveReducer', () => {
  it('sorts entries into roll-call order on init', () => {
    expect(base().entries.map((e) => e.sort_order).slice(0, 3)).toEqual([1, 2, 3]);
  });

  it('applies a newer entry update', () => {
    const updated = { ...SAMPLE_ENTRIES[1], responded: true, updated_at: '2026-10-07T02:51:00.000Z' };
    const next = liveReducer(base(), { type: 'entry', payload: updated });
    expect(next.entries.find((e) => e.id === 'e2')?.responded).toBe(true);
    expect(next.entries).toHaveLength(24);
  });

  it('ignores a stale broadcast that arrives late', () => {
    const fresh = liveReducer(base(), { type: 'entry', payload: { ...SAMPLE_ENTRIES[1], remarks: 'new', updated_at: '2026-10-07T02:55:00.000Z' } });
    const stale = liveReducer(fresh, { type: 'entry', payload: { ...SAMPLE_ENTRIES[1], remarks: 'old', updated_at: '2026-10-07T02:54:00.000Z' } });
    expect(stale.entries.find((e) => e.id === 'e2')?.remarks).toBe('new');
  });

  it('applies an update with the same timestamp', () => {
    const same = liveReducer(base(), { type: 'entry', payload: { ...SAMPLE_ENTRIES[1], remarks: 'same-ts' } });
    expect(same.entries.find((e) => e.id === 'e2')?.remarks).toBe('same-ts');
  });

  it('inserts a new entry in order and removes deleted ones', () => {
    const added = liveReducer(base(), { type: 'entry', payload: makeEntry(25, 'New Brgy', 'Zulu', 'Upland') });
    expect(added.entries.map((e) => e.barangay_name).indexOf('New Brgy')).toBe(6);
    const removed = liveReducer(added, { type: 'entry', payload: { id: 'e25', deleted: true } });
    expect(removed.entries).toHaveLength(24);
  });

  it('ignores entries from another report', () => {
    const other = { ...SAMPLE_ENTRIES[0], id: 'x1', report_id: 'other' };
    expect(liveReducer(base(), { type: 'entry', payload: other }).entries).toHaveLength(24);
  });

  it('updates the report header and marks deletion', () => {
    const renamed = liveReducer(base(), { type: 'report', payload: { ...SAMPLE_REPORT, remarks: 'Updated', updated_at: '2026-10-07T03:00:00.000Z' } });
    expect(renamed.report.remarks).toBe('Updated');
    const stale = liveReducer(renamed, { type: 'report', payload: { ...SAMPLE_REPORT, remarks: 'Old' } });
    expect(stale.report.remarks).toBe('Updated');
    expect(liveReducer(renamed, { type: 'report', payload: { id: 'r1', deleted: true } }).deleted).toBe(true);
  });

  it('resets to a fresh server snapshot', () => {
    const deleted = { ...base(), deleted: true };
    const reset = liveReducer(deleted, { type: 'reset', bundle: { report: SAMPLE_REPORT, entries: SAMPLE_ENTRIES } });
    expect(reset.deleted).toBe(false);
  });

  it('reports the latest change time', () => {
    const entries = [...SAMPLE_ENTRIES];
    entries[5] = { ...entries[5], updated_at: '2026-10-07T03:10:00.123456+00:00' };
    expect(lastUpdatedAt({ report: SAMPLE_REPORT, entries })).toBe('2026-10-07T03:10:00.123456+00:00');
  });

  describe('merge', () => {
    it('keeps newer live entry and report when the snapshot is older', () => {
      const live = liveReducer(
        liveReducer(base(), { type: 'entry', payload: { ...SAMPLE_ENTRIES[1], remarks: 'live', updated_at: '2026-10-07T02:55:00.000Z' } }),
        { type: 'report', payload: { ...SAMPLE_REPORT, remarks: 'live-report', updated_at: '2026-10-07T03:00:00.000Z' } },
      );
      const next = liveReducer(live, { type: 'merge', bundle: { report: SAMPLE_REPORT, entries: SAMPLE_ENTRIES }, fetchStartedAt: AFTER });
      expect(next.entries.find((e) => e.id === 'e2')?.remarks).toBe('live');
      expect(next.report.remarks).toBe('live-report');
    });

    it('applies newer snapshot rows', () => {
      const newerReport = { ...SAMPLE_REPORT, remarks: 'snap', updated_at: '2026-10-07T04:00:00.000Z' };
      const entries = SAMPLE_ENTRIES.map((e) => (e.id === 'e2' ? { ...e, remarks: 'snap', updated_at: '2026-10-07T04:00:00.000Z' } : e));
      const next = liveReducer(base(), { type: 'merge', bundle: { report: newerReport, entries }, fetchStartedAt: AFTER });
      expect(next.entries.find((e) => e.id === 'e2')?.remarks).toBe('snap');
      expect(next.report.remarks).toBe('snap');
      expect(next.deleted).toBe(false);
    });

    it('drops entries missing from the snapshot', () => {
      const next = liveReducer(base(), { type: 'merge', bundle: { report: SAMPLE_REPORT, entries: SAMPLE_ENTRIES.slice(1) }, fetchStartedAt: AFTER });
      expect(next.entries).toHaveLength(23);
      expect(next.entries.some((e) => e.id === SAMPLE_ENTRIES[0].id)).toBe(false);
    });

    it('behaves like reset for a different report id', () => {
      const other = { ...SAMPLE_REPORT, id: 'r2', updated_at: '2000-01-01T00:00:00.000Z' };
      const bundle = { report: other, entries: SAMPLE_ENTRIES.slice(0, 2).map((e) => ({ ...e, report_id: 'r2' })) };
      expect(liveReducer(base(), { type: 'merge', bundle, fetchStartedAt: AFTER })).toEqual(liveReducer(base(), { type: 'reset', bundle }));
    });
  });
});

describe('liveReducer robustness', () => {
  it('never throws on a malformed entry payload', () => {
    const broken: Record<string, unknown> = { ...SAMPLE_ENTRIES[1] };
    delete broken.barangay_name;
    const bad = broken as unknown as ReportEntry;
    expect(() => liveReducer(base(), { type: 'entry', payload: bad })).not.toThrow();
    expect(() => sortEntries([bad, { ...bad, id: 'e2b' }, ...SAMPLE_ENTRIES])).not.toThrow();
    const twice = liveReducer(base(), { type: 'entry', payload: { ...bad, id: 'e2b' } });
    expect(() => liveReducer(twice, { type: 'entry', payload: bad })).not.toThrow();
  });

  it('lets a resync correct a far-future forged row', () => {
    const forged = { ...SAMPLE_ENTRIES[1], road: 'unpassable' as const, updated_at: '9999-01-01T00:00:00.000Z' };
    const poisoned = liveReducer(base(), { type: 'entry', payload: forged });
    expect(poisoned.entries.find((e) => e.id === 'e2')?.road).toBe('unpassable');
    const fetchStartedAt = Date.parse('2026-10-07T03:00:00.000Z');
    const next = liveReducer(poisoned, { type: 'merge', bundle: { report: SAMPLE_REPORT, entries: SAMPLE_ENTRIES }, fetchStartedAt });
    expect(next.entries.find((e) => e.id === 'e2')).toEqual(SAMPLE_ENTRIES[1]);
  });

  it('lets a resync correct a far-future forged report', () => {
    const forged = { ...SAMPLE_REPORT, weather_summary_override: 'FAKE', updated_at: '9999-01-01T00:00:00.000Z' };
    const poisoned = liveReducer(base(), { type: 'report', payload: forged });
    const next = liveReducer(poisoned, {
      type: 'merge',
      bundle: { report: SAMPLE_REPORT, entries: SAMPLE_ENTRIES },
      fetchStartedAt: Date.parse('2026-10-07T03:00:00.000Z'),
    });
    expect(next.report).toEqual(SAMPLE_REPORT);
  });

  it('keeps a live row newer than the snapshot only when it predates the fetch', () => {
    const live = liveReducer(base(), { type: 'entry', payload: { ...SAMPLE_ENTRIES[1], remarks: 'live', updated_at: '2026-10-07T02:55:00.000Z' } });
    const bundle = { report: SAMPLE_REPORT, entries: SAMPLE_ENTRIES };
    const before = liveReducer(live, { type: 'merge', bundle, fetchStartedAt: Date.parse('2026-10-07T02:56:00.000Z') });
    expect(before.entries.find((e) => e.id === 'e2')?.remarks).toBe('live');
    const after = liveReducer(live, { type: 'merge', bundle, fetchStartedAt: Date.parse('2026-10-07T02:54:00.000Z') });
    expect(after.entries.find((e) => e.id === 'e2')?.remarks).toBe(SAMPLE_ENTRIES[1].remarks);
  });
});
