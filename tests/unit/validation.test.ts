import { describe, expect, it } from 'vitest';
import { entryPatchSchema, newReportSchema, reportPatchSchema, staffSchema } from '@/lib/validation';

const UUID = '3f2b6a0e-9c1d-4e5f-8a7b-1c2d3e4f5a6b';

describe('entryPatchSchema', () => {
  it('accepts valid partial patches', () => {
    expect(entryPatchSchema.safeParse({ road: 'passable' }).success).toBe(true);
    expect(entryPatchSchema.safeParse({ weather_option_id: UUID, responded: true }).success).toBe(true);
    expect(entryPatchSchema.safeParse({ wind_option_id: null }).success).toBe(true);
  });
  it('rejects bad values, unknown keys and empty patches', () => {
    expect(entryPatchSchema.safeParse({ road: 'closed' }).success).toBe(false);
    expect(entryPatchSchema.safeParse({ report_id: UUID }).success).toBe(false);
    expect(entryPatchSchema.safeParse({}).success).toBe(false);
    expect(entryPatchSchema.safeParse({ remarks: 'x'.repeat(501) }).success).toBe(false);
  });
});

describe('reportPatchSchema', () => {
  it('accepts ISO times and trims text', () => {
    const r = reportPatchSchema.safeParse({ report_at: '2026-10-07T02:50:00.000Z', remarks: '  ok  ' });
    expect(r.success && r.data.remarks).toBe('ok');
  });
  it('requires a preparer name when provided', () => {
    expect(reportPatchSchema.safeParse({ prepared_by_name: '  ' }).success).toBe(false);
  });
});

describe('newReportSchema', () => {
  it('requires a datetime-local value', () => {
    expect(newReportSchema.safeParse({ report_at_local: '2026-10-07 10:50', prepared_by_name: 'A', prepared_by_position: '' }).success).toBe(false);
    expect(newReportSchema.safeParse({ report_at_local: '2026-10-07T10:50', prepared_by_name: 'A', prepared_by_position: '' }).success).toBe(true);
    expect(newReportSchema.safeParse({ report_at_local: '2026-13-45T99:99', prepared_by_name: 'A', prepared_by_position: '' }).success).toBe(false);
  });
});

describe('staffSchema', () => {
  it('normalizes emails to lowercase', () => {
    const r = staffSchema.safeParse({ email: '  Juan.Dela@Gmail.com ', full_name: 'Juan', position: '' });
    expect(r.success && r.data.email).toBe('juan.dela@gmail.com');
    expect(staffSchema.safeParse({ email: 'not-an-email', full_name: 'J', position: '' }).success).toBe(false);
  });
});
