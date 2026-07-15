/**
 * ADR-641 Φ4 — unit tests for the shared z-order render-list SSoT (`moveEntityInList` /
 * `frontBackTargetIndex`), extracted from the two `ISceneManager` adapters (CHECK 3.28 de-dup).
 *
 * ADR-661 — added `moveEntitiesInList` (batch send-to-back / bring-to-front) coverage.
 */

import { moveEntityInList, frontBackTargetIndex, moveEntitiesInList } from '../entity-zorder-ops';

const ids = (list: Array<{ id: string }> | null): string[] => (list ?? []).map((e) => e.id);
const make = (...names: string[]) => names.map((id) => ({ id }));

describe('frontBackTargetIndex (ADR-641)', () => {
  it('front → list length (end), back → 0 (start)', () => {
    expect(frontBackTargetIndex('front', 5)).toBe(5);
    expect(frontBackTargetIndex('back', 5)).toBe(0);
  });
});

describe('moveEntityInList (ADR-641)', () => {
  it('moves an entity to front (end) preserving other order', () => {
    const list = make('a', 'b', 'c');
    const next = moveEntityInList(list, 'a', frontBackTargetIndex('front', list.length));
    expect(ids(next)).toEqual(['b', 'c', 'a']);
    expect(list.map((e) => e.id)).toEqual(['a', 'b', 'c']); // original untouched
  });

  it('moves an entity to back (start)', () => {
    const list = make('a', 'b', 'c');
    expect(ids(moveEntityInList(list, 'c', frontBackTargetIndex('back', list.length)))).toEqual(['c', 'a', 'b']);
  });

  it('moves an entity to an exact index (clamped)', () => {
    const list = make('a', 'b', 'c', 'd');
    expect(ids(moveEntityInList(list, 'a', 2))).toEqual(['b', 'c', 'a', 'd']);
    expect(ids(moveEntityInList(list, 'a', 99))).toEqual(['b', 'c', 'd', 'a']); // clamp high
    expect(ids(moveEntityInList(list, 'd', -5))).toEqual(['d', 'a', 'b', 'c']); // clamp low
  });

  it('returns null when the id is absent (caller no-ops)', () => {
    expect(moveEntityInList(make('a', 'b'), 'ghost', 0)).toBeNull();
  });
});

describe('moveEntitiesInList (ADR-661)', () => {
  it('back moves the id-set to the front (array start) preserving the SET\'s relative order', () => {
    const list = make('a', 'b', 'c', 'd', 'e');
    // moved set given as {d, b} — original relative order is b, d (b comes before d in `list`)
    const next = moveEntitiesInList(list, new Set(['d', 'b']), 'back');
    expect(ids(next)).toEqual(['b', 'd', 'a', 'c', 'e']);
  });

  it('front moves the id-set to the end (array end) preserving the SET\'s relative order', () => {
    const list = make('a', 'b', 'c', 'd', 'e');
    const next = moveEntitiesInList(list, new Set(['d', 'b']), 'front');
    expect(ids(next)).toEqual(['a', 'c', 'e', 'b', 'd']);
  });

  it('returns null when NONE of the ids are present', () => {
    expect(moveEntitiesInList(make('a', 'b', 'c'), new Set(['x', 'y']), 'back')).toBeNull();
  });

  it('returns null for an empty id set', () => {
    expect(moveEntitiesInList(make('a', 'b', 'c'), new Set(), 'back')).toBeNull();
  });

  it('moves only the ids that ARE present, ignoring unknown ids mixed into the set', () => {
    const list = make('a', 'b', 'c');
    expect(ids(moveEntitiesInList(list, new Set(['c', 'ghost']), 'back'))).toEqual(['c', 'a', 'b']);
  });

  it('preserves the relative order of the NON-moved ("rest") entities', () => {
    const list = make('a', 'b', 'c', 'd', 'e', 'f');
    const next = moveEntitiesInList(list, new Set(['a', 'f']), 'front');
    // rest = b, c, d, e — must stay in that exact relative order
    expect(ids(next)).toEqual(['b', 'c', 'd', 'e', 'a', 'f']);
  });

  it('single-id batch move has the same outcome as moveEntityInList to back/front', () => {
    const list = make('a', 'b', 'c', 'd');

    const batchBack = moveEntitiesInList(list, new Set(['c']), 'back');
    const singleBack = moveEntityInList(list, 'c', frontBackTargetIndex('back', list.length));
    expect(ids(batchBack)).toEqual(ids(singleBack));

    const batchFront = moveEntitiesInList(list, new Set(['b']), 'front');
    const singleFront = moveEntityInList(list, 'b', frontBackTargetIndex('front', list.length));
    expect(ids(batchFront)).toEqual(ids(singleFront));
  });

  it('does not mutate the original array', () => {
    const list = make('a', 'b', 'c');
    moveEntitiesInList(list, new Set(['a']), 'front');
    expect(list.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });
});
