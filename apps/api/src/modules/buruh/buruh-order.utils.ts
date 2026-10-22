import type { Prisma } from '@prisma/client';

export type MoveDirection = 'up' | 'down';

// Shared by Buruh Management and tanda terima so both list buruh in the same order
export const BURUH_ORDER_BY: Prisma.BuruhOrderByWithRelationInput[] = [
  { sortOrder: 'asc' },
  { name: 'asc' },
  { id: 'asc' },
];

/**
 * Returns a copy of `items` with the item at `index` swapped with its
 * neighbour, or null when it is already at the top/bottom.
 */
export function moveItem<T>(
  items: readonly T[],
  index: number,
  direction: MoveDirection,
): T[] | null {
  const target = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) {
    return null;
  }
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/**
 * Renumbers the list 1..n and returns only the rows whose stored order changes,
 * so duplicates or gaps left by older data are healed by the same write.
 */
export function sortOrderChanges<T extends { id: number; sortOrder: number }>(
  ordered: readonly T[],
): { id: number; sortOrder: number }[] {
  return ordered
    .map((item, i) => ({ id: item.id, sortOrder: i + 1, current: item.sortOrder }))
    .filter((row) => row.sortOrder !== row.current)
    .map(({ id, sortOrder }) => ({ id, sortOrder }));
}
