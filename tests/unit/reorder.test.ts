import { describe, expect, it } from 'vitest';
import { moveWithinGroup } from '@/lib/reorder';

const group = [
  { id: 'a', sort_order: 14 },
  { id: 'b', sort_order: 15 },
  { id: 'c', sort_order: 16 },
];

describe('moveWithinGroup', () => {
  it('swaps with the neighbour and returns only changed rows', () => {
    expect(moveWithinGroup(group, 'b', 'up')).toEqual([{ id: 'b', sort_order: 14 }, { id: 'a', sort_order: 15 }]);
    expect(moveWithinGroup(group, 'b', 'down')).toEqual([{ id: 'c', sort_order: 15 }, { id: 'b', sort_order: 16 }]);
  });
  it('does nothing at the edges or for unknown ids', () => {
    expect(moveWithinGroup(group, 'a', 'up')).toEqual([]);
    expect(moveWithinGroup(group, 'c', 'down')).toEqual([]);
    expect(moveWithinGroup(group, 'zzz', 'up')).toEqual([]);
  });
  it('renumbers when sort orders are duplicated', () => {
    const dupes = [{ id: 'a', sort_order: 5 }, { id: 'b', sort_order: 5 }, { id: 'c', sort_order: 5 }];
    expect(moveWithinGroup(dupes, 'c', 'up')).toEqual([{ id: 'c', sort_order: 6 }, { id: 'b', sort_order: 7 }]);
  });
});
