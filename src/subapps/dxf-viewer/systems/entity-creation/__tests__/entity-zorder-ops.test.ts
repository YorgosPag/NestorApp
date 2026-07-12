/**
 * ADR-641 Φ4 — unit tests for the shared z-order render-list SSoT (`moveEntityInList` /
 * `frontBackTargetIndex`), extracted from the two `ISceneManager` adapters (CHECK 3.28 de-dup).
 */

import { moveEntityInList, frontBackTargetIndex } from '../entity-zorder-ops';

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
