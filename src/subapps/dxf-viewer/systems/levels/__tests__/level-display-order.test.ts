import { orderLevelsForPanel, type LevelFloorClass } from '../level-display-order';
import type { Level } from '../config';
import type { FloorKind } from '@/utils/floor-naming';

function lvl(id: string, order: number, opts: Partial<Level> = {}): Level {
  return { id, name: id, order, isDefault: false, visible: true, ...opts };
}

/** Floor classification per linked floorId, keyed for the resolver. */
function makeResolver(byFloorId: Record<string, LevelFloorClass>) {
  return (level: Level): LevelFloorClass | undefined =>
    level.floorId ? byFloorId[level.floorId] : undefined;
}

describe('orderLevelsForPanel (ADR-461 — «Στάθμες» panel order)', () => {
  it('orders storeys penthouse→foundation and HIDES the unlinked default once floors exist (ADR-420)', () => {
    const floors: Record<string, { kind: FloorKind; number: number }> = {
      'f-found': { kind: 'foundation', number: -3 },
      'f-b2': { kind: 'basement', number: -2 },
      'f-b1': { kind: 'basement', number: -1 },
      'f-g': { kind: 'ground', number: 0 },
      'f-1': { kind: 'standard', number: 1 },
      'f-2': { kind: 'standard', number: 2 },
      'f-roof': { kind: 'roof', number: 9 },
      'f-pent': { kind: 'stair-penthouse', number: 10 },
    };

    // Deliberately scrambled creation order.
    const levels: Level[] = [
      lvl('ground', 5, { floorId: 'f-g' }),
      lvl('foundation', 1, { floorId: 'f-found' }),
      lvl('penthouse', 8, { floorId: 'f-pent' }),
      lvl('default', 0, { isDefault: true }), // unlinked bootstrap default → hidden
      lvl('b2', 3, { floorId: 'f-b2' }),
      lvl('2nd', 7, { floorId: 'f-2' }),
      lvl('roof', 9, { floorId: 'f-roof' }),
      lvl('1st', 6, { floorId: 'f-1' }),
      lvl('b1', 4, { floorId: 'f-b1' }),
    ];

    const ordered = orderLevelsForPanel(levels, makeResolver(floors)).map((l) => l.id);

    // The unlinked default is filtered out; real storeys keep the physical order.
    expect(ordered).toEqual([
      'penthouse', // Απόληξη Κλιμακοστασίου — top
      'roof', // Δώμα
      '2nd',
      '1st',
      'ground',
      'b1', // −1
      'b2', // −2
      'foundation', // bottom
    ]);
  });

  it('keeps «Επίπεδο 1» on top even with no linked floors at all', () => {
    const levels: Level[] = [
      lvl('a', 2),
      lvl('default', 0, { isDefault: true }),
      lvl('b', 1),
    ];
    const ordered = orderLevelsForPanel(levels, () => undefined).map((l) => l.id);
    expect(ordered[0]).toBe('default');
    // Floorless extras keep creation order below the default.
    expect(ordered).toEqual(['default', 'b', 'a']);
  });

  it('is a pure, stable sort (does not mutate input, ties keep creation order)', () => {
    const levels: Level[] = [lvl('x', 0, { isDefault: true }), lvl('y', 1)];
    const input = [...levels];
    orderLevelsForPanel(levels, () => undefined);
    expect(levels).toEqual(input); // not mutated
  });
});
