import { manilaDayKey } from '@/lib/format';
import type { Barangay, RadioOperator, Zone } from '@/lib/types';

const MONTH_KEY = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DAY_KEY = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const monthFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' });
const weekdayFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'narrow' });

export function isMonthKey(value: string): boolean {
  return MONTH_KEY.test(value);
}

/** A real calendar day as YYYY-MM-DD (rejects 2026-02-30). */
export function isDayKey(value: string): boolean {
  const m = DAY_KEY.exec(value);
  return !!m && Number(m[3]) <= daysInMonth(`${m[1]}-${m[2]}`);
}

/** The current month in Manila as YYYY-MM. */
export function currentMonthKey(now = new Date()): string {
  return manilaDayKey(now.toISOString()).slice(0, 7);
}

function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Every day of the month, with a one-letter weekday and a weekend flag for the grid header. */
export function monthDays(month: string): { key: string; day: number; weekday: string; weekend: boolean }[] {
  const [y, m] = month.split('-').map(Number);
  return Array.from({ length: daysInMonth(month) }, (_, i) => {
    const date = new Date(Date.UTC(y, m - 1, i + 1));
    const dow = date.getUTCDay();
    return { key: `${month}-${String(i + 1).padStart(2, '0')}`, day: i + 1, weekday: weekdayFmt.format(date), weekend: dow === 0 || dow === 6 };
  });
}

export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return monthFmt.format(new Date(Date.UTC(y, m - 1, 1)));
}

/** Operators in roll-call order: zone, then barangay, then name. */
export function sortOperators(operators: RadioOperator[], barangays: Barangay[], zones: Zone[]): RadioOperator[] {
  const zoneSort = new Map(zones.map((z) => [z.id, z.sort_order]));
  const rank = new Map(barangays.map((b) => [b.id, [zoneSort.get(b.zone_id) ?? 0, b.sort_order] as const]));
  return [...operators].sort((a, b) => {
    const [za, ba] = rank.get(a.barangay_id) ?? [Infinity, Infinity];
    const [zb, bb] = rank.get(b.barangay_id) ?? [Infinity, Infinity];
    return za - zb || ba - bb || a.name.localeCompare(b.name);
  });
}
