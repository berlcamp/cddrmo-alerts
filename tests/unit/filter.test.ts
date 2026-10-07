import { describe, expect, it } from 'vitest';
import { filterEntries, groupByZone, zoneNames } from '@/lib/filter';
import { SAMPLE_ENTRIES } from '../fixtures/sample-sitrep';

describe('filter', () => {
  it('lists zones in roll-call order', () => {
    expect(zoneNames(SAMPLE_ENTRIES)).toEqual(['Upland', 'Midland', 'Lowland', 'Coastal']);
  });
  it('groups by zone keeping order', () => {
    expect(groupByZone(SAMPLE_ENTRIES).map((g) => [g.zone, g.entries.length])).toEqual([
      ['Upland', 6], ['Midland', 7], ['Lowland', 7], ['Coastal', 4],
    ]);
  });
  it('filters by zone and issues', () => {
    expect(filterEntries(SAMPLE_ENTRIES, 'Coastal', false).map((e) => e.barangay_name)).toEqual([
      'Baybay Triunfo', 'Malaubang', 'Catadman-Manabay', 'San Antonio',
    ]);
    expect(filterEntries(SAMPLE_ENTRIES, 'all', true)).toHaveLength(9);
    expect(filterEntries(SAMPLE_ENTRIES, 'Coastal', true).map((e) => e.barangay_name)).toEqual(['Catadman-Manabay', 'San Antonio']);
  });
});
