import { manilaDayKey } from '@/lib/format';
import type { RadioOperator } from '@/lib/types';

const MONTH_KEY = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DAY_KEY = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const monthFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' });
const shortDayFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
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

/** "Oct 2" for a YYYY-MM-DD day. */
export function formatShortDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return shortDayFmt.format(new Date(Date.UTC(y, m - 1, d)));
}

export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return monthFmt.format(new Date(Date.UTC(y, m - 1, 1)));
}

export const ABSENCE_WINDOW = 14;
export const ABSENCE_THRESHOLD = 3;

export function addDays(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

export interface AbsentOperator {
  operator: RadioOperator;
  /** Days in the window the operator was not marked present. */
  missed: number;
  /** Days in the window counted for this operator (fewer when they were added recently). */
  tracked: number;
  /** Consecutive missed days ending yesterday. */
  streak: number;
  lastPresent: string | null;
}

/**
 * Active operators who missed at least `ABSENCE_THRESHOLD` of the `ABSENCE_WINDOW` days ending yesterday.
 * Today is left out because it is still being marked; days before the operator was added don't count.
 */
export function recurringAbsences(
  operators: (RadioOperator & { created_at: string })[],
  attendance: { operator_id: string; day: string }[],
  today: string,
): AbsentOperator[] {
  const present = new Set(attendance.map((a) => `${a.operator_id}|${a.day}`));
  const lastPresent = new Map<string, string>();
  for (const a of attendance) if (a.day < today && a.day > (lastPresent.get(a.operator_id) ?? '')) lastPresent.set(a.operator_id, a.day);
  const window = Array.from({ length: ABSENCE_WINDOW }, (_, i) => addDays(today, -1 - i)); // newest first
  return operators
    .filter((o) => o.status === 'active')
    .map((operator) => {
      const since = manilaDayKey(operator.created_at);
      const days = window.filter((d) => d >= since);
      const absent = days.map((d) => !present.has(`${operator.id}|${d}`));
      const streak = absent.findIndex((a) => !a);
      return {
        operator,
        missed: absent.filter(Boolean).length,
        tracked: days.length,
        streak: streak === -1 ? absent.length : streak,
        lastPresent: lastPresent.get(operator.id) ?? null,
      };
    })
    .filter((a) => a.missed >= ABSENCE_THRESHOLD)
    .sort((a, b) => b.missed - a.missed || b.streak - a.streak || a.operator.name.localeCompare(b.operator.name));
}
