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
