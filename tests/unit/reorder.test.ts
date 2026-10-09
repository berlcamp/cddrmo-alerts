import { describe, expect, it } from 'vitest';
import { reorderGroup } from '@/lib/reorder';

const group = [
  { id: 'a', sort_order: 14 },
  { id: 'b', sort_order: 15 },
  { id: 'c', sort_order: 16 },
];

describe('reorderGroup', () => {
  it('reuses the group slots in the new order and returns only changed rows', () => {
    expect(reorderGroup(group, ['c', 'a', 'b'])).toEqual([
      { id: 'c', sort_order: 14 },
      { id: 'a', sort_order: 15 },
      { id: 'b', sort_order: 16 },
    ]);
    expect(reorderGroup(group, ['a', 'c', 'b'])).toEqual([{ id: 'c', sort_order: 15 }, { id: 'b', sort_order: 16 }]);
    expect(reorderGroup(group, ['a', 'b', 'c'])).toEqual([]);
  });
  it('rejects ids that are not exactly the group', () => {
    expect(reorderGroup(group, ['a', 'b'])).toBeNull();
    expect(reorderGroup(group, ['a', 'b', 'b'])).toBeNull();
    expect(reorderGroup(group, ['a', 'b', 'zzz'])).toBeNull();
  });
  it('renumbers when sort orders are duplicated', () => {
    const dup = [{ id: 'a', sort_order: 3 }, { id: 'b', sort_order: 3 }, { id: 'c', sort_order: 3 }];
    expect(reorderGroup(dup, ['b', 'a', 'c'])).toEqual([{ id: 'a', sort_order: 4 }, { id: 'c', sort_order: 5 }]);
  });
});
