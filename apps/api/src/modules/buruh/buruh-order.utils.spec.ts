import { moveItem, sortOrderChanges } from '@/modules/buruh/buruh-order.utils';

describe('moveItem', () => {
  it('swaps with the previous item when moving up', () => {
    expect(moveItem(['a', 'b', 'c'], 2, 'up')).toEqual(['a', 'c', 'b']);
  });

  it('swaps with the next item when moving down', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 'down')).toEqual(['b', 'a', 'c']);
  });

  it('returns null at the edges or for an unknown index', () => {
    expect(moveItem(['a', 'b'], 0, 'up')).toBeNull();
    expect(moveItem(['a', 'b'], 1, 'down')).toBeNull();
    expect(moveItem(['a', 'b'], -1, 'down')).toBeNull();
  });

  it('does not mutate the input', () => {
    const items = ['a', 'b'];
    moveItem(items, 0, 'down');
    expect(items).toEqual(['a', 'b']);
  });
});

describe('sortOrderChanges', () => {
  it('only returns rows whose position changed', () => {
    expect(
      sortOrderChanges([
        { id: 1, sortOrder: 1 },
        { id: 3, sortOrder: 3 },
        { id: 2, sortOrder: 2 },
      ]),
    ).toEqual([
      { id: 3, sortOrder: 2 },
      { id: 2, sortOrder: 3 },
    ]);
  });

  it('heals duplicates and gaps from older data', () => {
    expect(
      sortOrderChanges([
        { id: 1, sortOrder: 0 },
        { id: 2, sortOrder: 0 },
        { id: 3, sortOrder: 7 },
      ]),
    ).toEqual([
      { id: 1, sortOrder: 1 },
      { id: 2, sortOrder: 2 },
      { id: 3, sortOrder: 3 },
    ]);
  });
});
