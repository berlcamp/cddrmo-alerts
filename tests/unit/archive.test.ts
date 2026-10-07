import { describe, expect, it } from 'vitest';
import { groupArchiveByDay } from '@/lib/archive';

const item = (report_at: string) => ({ report: { report_at } });

describe('groupArchiveByDay', () => {
  it('groups newest-first items by Manila day, including just after midnight', () => {
    const days = groupArchiveByDay([
      item('2026-10-07T06:50:00Z'), // 14:50 Oct 7
      item('2026-10-06T16:05:00Z'), // 00:05 Oct 7
      item('2026-10-06T15:55:00Z'), // 23:55 Oct 6
    ]);
    expect(days.map((d) => [d.day, d.items.length])).toEqual([
      ['2026-10-07', 2],
      ['2026-10-06', 1],
    ]);
  });
  it('returns nothing for no items', () => {
    expect(groupArchiveByDay([])).toEqual([]);
  });
});
