export function moveWithinGroup<T extends { id: string; sort_order: number }>(
  group: T[],
  id: string,
  direction: 'up' | 'down',
): { id: string; sort_order: number }[] {
  const ordered = [...group].sort((a, b) => a.sort_order - b.sort_order);
  const i = ordered.findIndex((row) => row.id === id);
  const j = direction === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ordered.length) return [];
  const values = ordered.map((row) => row.sort_order);
  const slots = new Set(values).size === values.length ? values : values.map((_, k) => values[0] + k);
  const original = new Map(ordered.map((row) => [row.id, row.sort_order]));
  [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
  return ordered
    .map((row, k) => ({ id: row.id, sort_order: slots[k] }))
    .filter((row) => original.get(row.id) !== row.sort_order);
}

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
