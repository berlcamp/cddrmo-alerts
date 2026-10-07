import { describe, expect, it } from 'vitest';
import {
  formatClock, formatDayHeading, formatMilitaryTime, formatReportDate, formatReportHeading,
  formatShortHeading, fromManilaInputValue, manilaDayKey, toManilaInputValue,
} from '@/lib/format';

const AT_1050 = '2026-10-07T02:50:00.000Z'; // 10:50 in Manila

describe('Manila formatting', () => {
  it('formats the report heading like the paper form', () => {
    expect(formatReportDate(AT_1050)).toBe('October 7, 2026');
    expect(formatMilitaryTime(AT_1050)).toBe('1050H');
    expect(formatReportHeading(AT_1050)).toBe('October 7, 2026 – 1050H');
    expect(formatShortHeading(AT_1050)).toBe('Oct 7, 2026 1050H');
  });

  it('uses the Manila date just after midnight, not the UTC date', () => {
    const justAfterMidnight = '2026-10-06T16:05:00.000Z'; // 00:05 on Oct 7 in Manila
    expect(formatMilitaryTime(justAfterMidnight)).toBe('0005H');
    expect(formatReportDate(justAfterMidnight)).toBe('October 7, 2026');
    expect(manilaDayKey(justAfterMidnight)).toBe('2026-10-07');
  });

  it('formats clock and day headings', () => {
    expect(formatClock('2026-10-07T02:52:14.000Z')).toBe('10:52:14');
    expect(formatDayHeading('2026-10-07')).toBe('Wednesday, October 7, 2026');
  });

  it('round-trips datetime-local values in Manila time', () => {
    expect(toManilaInputValue(AT_1050)).toBe('2026-10-07T10:50');
    expect(fromManilaInputValue('2026-10-07T10:50')).toBe(AT_1050);
    expect(() => fromManilaInputValue('10:50')).toThrow('Invalid date/time');
  });

  it('accepts Postgres timestamps with microseconds and offsets', () => {
    expect(formatMilitaryTime('2026-10-07T10:50:00.123456+08:00')).toBe('1050H');
  });
});
