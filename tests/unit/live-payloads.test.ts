import { describe, expect, it } from 'vitest';
import { parseEntryPayload, parseReportPayload, parseReportsChanged } from '@/lib/live/payloads';
import { SAMPLE_ENTRIES, SAMPLE_REPORT } from '../fixtures/sample-sitrep';

const NOW = Date.parse('2026-10-07T03:00:00.000Z');

describe('parseEntryPayload', () => {
  it('accepts a full entry row and strips unknown columns', () => {
    const parsed = parseEntryPayload({ ...SAMPLE_ENTRIES[0], updated_by: 'u1', created_at: SAMPLE_ENTRIES[0].updated_at }, NOW);
    expect(parsed).toEqual(SAMPLE_ENTRIES[0]);
  });

  it('accepts a deletion', () => {
    expect(parseEntryPayload({ id: 'e1', deleted: true }, NOW)).toEqual({ id: 'e1', deleted: true });
  });

  it('drops malformed rows', () => {
    const missingName: Record<string, unknown> = { ...SAMPLE_ENTRIES[0] };
    delete missingName.barangay_name;
    expect(parseEntryPayload(missingName, NOW)).toBeNull();
    expect(parseEntryPayload({ ...SAMPLE_ENTRIES[0], road: 'flooded' }, NOW)).toBeNull();
    expect(parseEntryPayload({ ...SAMPLE_ENTRIES[0], updated_at: 'not a date' }, NOW)).toBeNull();
    expect(parseEntryPayload(null, NOW)).toBeNull();
    expect(parseEntryPayload('entry', NOW)).toBeNull();
    expect(parseEntryPayload({ id: 'e1', deleted: 'yes' }, NOW)).toBeNull();
  });

  it('drops rows dated more than 5 minutes in the future', () => {
    expect(parseEntryPayload({ ...SAMPLE_ENTRIES[0], updated_at: '9999-12-31T00:00:00.000Z' }, NOW)).toBeNull();
    expect(parseEntryPayload({ ...SAMPLE_ENTRIES[0], updated_at: '2026-10-07T03:05:01.000Z' }, NOW)).toBeNull();
    expect(parseEntryPayload({ ...SAMPLE_ENTRIES[0], updated_at: '2026-10-07T03:04:59.000Z' }, NOW)).not.toBeNull();
  });
});

describe('parseReportPayload', () => {
  it('accepts a report row and a deletion', () => {
    expect(parseReportPayload({ ...SAMPLE_REPORT, created_by: 'u1' }, NOW)).toEqual(SAMPLE_REPORT);
    expect(parseReportPayload({ id: 'r1', deleted: true }, NOW)).toEqual({ id: 'r1', deleted: true });
  });

  it('drops malformed or far-future reports', () => {
    expect(parseReportPayload({ ...SAMPLE_REPORT, weather_summary_override: 42 }, NOW)).toBeNull();
    expect(parseReportPayload({ id: 'r1' }, NOW)).toBeNull();
    expect(parseReportPayload({ ...SAMPLE_REPORT, updated_at: '9999-01-01T00:00:00Z' }, NOW)).toBeNull();
  });
});

describe('parseReportsChanged', () => {
  it('accepts a valid notice', () => {
    const notice = { id: 'r2', report_at: '2026-10-07T05:00:00+00:00', op: 'INSERT' };
    expect(parseReportsChanged(notice)).toEqual(notice);
  });

  it('drops malformed notices', () => {
    expect(parseReportsChanged({ id: 'r2', report_at: 'soon', op: 'INSERT' })).toBeNull();
    expect(parseReportsChanged({ id: 'r2', report_at: '2026-10-07T05:00:00Z', op: 'HACK' })).toBeNull();
    expect(parseReportsChanged(undefined)).toBeNull();
  });
});
