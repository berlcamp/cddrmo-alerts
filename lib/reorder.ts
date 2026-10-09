/** Sort-order changes that put `group` in `orderedIds` order, or null unless `orderedIds` is exactly the group's ids. */
export function reorderGroup<T extends { id: string; sort_order: number }>(
  group: T[],
  orderedIds: string[],
): { id: string; sort_order: number }[] | null {
  const ids = new Set(group.map((row) => row.id));
  if (orderedIds.length !== ids.size || new Set(orderedIds).size !== ids.size || !orderedIds.every((id) => ids.has(id))) return null;
  const values = group.map((row) => row.sort_order).sort((a, b) => a - b);
  const slots = new Set(values).size === values.length ? values : values.map((_, k) => values[0] + k);
  const original = new Map(group.map((row) => [row.id, row.sort_order]));
  return orderedIds
    .map((id, k) => ({ id, sort_order: slots[k] }))
    .filter((row) => original.get(row.id) !== row.sort_order);
}
