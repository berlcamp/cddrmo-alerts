import { describe, expect, it } from 'vitest';
import { currentMonthKey, formatMonth, isDayKey, isMonthKey, monthDays, shiftMonth, sortOperators } from '@/lib/attendance';
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
