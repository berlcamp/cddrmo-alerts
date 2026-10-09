import { describe, expect, it } from 'vitest';
import { addDays, currentMonthKey, recurringAbsences, formatMonth, formatShortDay, isDayKey, isMonthKey, monthDays, shiftMonth, sortOperators } from '@/lib/attendance';
import type { Barangay, RadioOperator, Zone } from '@/lib/types';
import { operatorSchema } from '@/lib/validation';

describe('month and day keys', () => {
  it('validates keys', () => {
    expect(isMonthKey('2026-10')).toBe(true);
    expect(isMonthKey('2026-13')).toBe(false);
    expect(isDayKey('2026-02-28')).toBe(true);
    expect(isDayKey('2026-02-29')).toBe(false);
    expect(isDayKey('2028-02-29')).toBe(true);
    expect(isDayKey('2026-10-1')).toBe(false);
  });
  it('uses the Manila month', () => {
    expect(currentMonthKey(new Date('2026-10-31T16:30:00Z'))).toBe('2026-11');
  });
  it('shifts across years', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });
  it('lists every day with weekday and weekend flags', () => {
    const days = monthDays('2026-10');
    expect(days).toHaveLength(31);
    expect(days[0]).toEqual({ key: '2026-10-01', day: 1, weekday: 'T', weekend: false });
    expect(days[2]).toMatchObject({ key: '2026-10-03', weekend: true });
    expect(monthDays('2026-02')).toHaveLength(28);
    expect(formatMonth('2026-10')).toBe('October 2026');
    expect(formatShortDay('2026-10-02')).toBe('Oct 2');
  });
});

describe('sortOperators', () => {
  const zones: Zone[] = [{ id: 'z2', name: 'Zone 2', sort_order: 2 }, { id: 'z1', name: 'Zone 1', sort_order: 1 }];
  const brgy = (id: string, zone_id: string, sort_order: number) => ({ id, zone_id, sort_order }) as Barangay;
  const op = (id: string, barangay_id: string, name: string) => ({ id, barangay_id, name }) as RadioOperator;
  it('orders by zone, barangay, then name', () => {
    const barangays = [brgy('a', 'z2', 1), brgy('b', 'z1', 5), brgy('c', 'z1', 2)];
    const sorted = sortOperators([op('1', 'a', 'Ana'), op('2', 'b', 'Ben'), op('3', 'c', 'Zed'), op('4', 'c', 'Abe')], barangays, zones);
    expect(sorted.map((o) => o.id)).toEqual(['4', '3', '2', '1']);
  });
});

describe('operatorSchema', () => {
  const base = { barangay_id: '3f2b6a0e-9c1d-4e5f-8a7b-1c2d3e4f5a6b', name: ' Juan ', callsign: '', position: '', contact_number: '0917 123 4567', status: 'active' };
  it('accepts a minimal operator and trims', () => {
    expect(operatorSchema.safeParse(base).data).toMatchObject({ name: 'Juan', contact_number: '0917 123 4567' });
  });
  it('rejects bad contact numbers, blank names and unknown status', () => {
    expect(operatorSchema.safeParse({ ...base, contact_number: 'call me' }).success).toBe(false);
    expect(operatorSchema.safeParse({ ...base, name: '  ' }).success).toBe(false);
    expect(operatorSchema.safeParse({ ...base, status: 'retired' }).success).toBe(false);
  });
});

describe('recurringAbsences', () => {
  const op = (id: string, created_at = '2026-01-01T00:00:00Z', status: 'active' | 'inactive' = 'active') =>
    ({ id, name: id, barangay_id: 'b', callsign: '', position: '', contact_number: '', status, created_at });
  const today = '2026-10-15';
  const presentOn = (id: string, ...days: number[]) => days.map((d) => ({ operator_id: id, day: `2026-10-${String(d).padStart(2, '0')}` }));

  it('steps days across months', () => {
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('flags operators with 3+ missed days in the 14 days before today', () => {
    // Window is Oct 1–14. "ok" misses 2 days, "bad" misses 5 (last four in a row), today never counts.
    const okDays = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const badDays = [1, 2, 3, 4, 5, 6, 7, 8, 10];
    const result = recurringAbsences([op('ok'), op('bad')], [...presentOn('ok', ...okDays), ...presentOn('bad', ...badDays, 15)], today);
    expect(result).toEqual([{ operator: op('bad'), missed: 5, tracked: 14, streak: 4, lastPresent: '2026-10-10' }]);
  });
  it('skips inactive operators and days before an operator was added', () => {
    const fresh = op('fresh', '2026-10-13T01:00:00Z');
    expect(recurringAbsences([fresh, op('off', undefined, 'inactive')], [], today)).toEqual([]);
    const result = recurringAbsences([op('new', '2026-10-10T01:00:00Z')], [], today);
    expect(result[0]).toMatchObject({ missed: 5, tracked: 5, streak: 5, lastPresent: null });
  });
});
