/**
 * @tests floor-row-model — ADR-912 §5: η ΜΙΑ γραμμή που διαβάζουν και ο πίνακας και η λίστα.
 */

import { buildFloorRowModel, floorRowTone } from '../floor-row-model';
import { makeFloorsState } from './floors-fixture';

describe('buildFloorRowModel', () => {
  it('derives an intermediate storey height from the elevations, ignoring the stored height', () => {
    // Ισόγειο: υψόμετρο 0, ο από πάνω στο 3 ⇒ 3.00 — όχι το αποθηκευμένο 9.99.
    const row = buildFloorRowModel(makeFloorsState(), 1);
    expect(row.isHeightDerived).toBe(true);
    expect(row.derivedHeight).toBe(3);
    expect(row.displayHeight).toBe(3);
  });

  it('keeps the explicit height where it is not derived (top storey · special level)', () => {
    const state = makeFloorsState();
    expect(buildFloorRowModel(state, 3).displayHeight).toBe(3.4);
    expect(buildFloorRowModel(state, 0).displayHeight).toBe(1.2);
  });

  it('shows no height at all when a non-derived floor has none stored', () => {
    const state = makeFloorsState({ heightDerivedFloorIds: new Set() });
    const floors = state.floors.map((f) => (f.id === 'f-2' ? { ...f, height: null } : f));
    expect(buildFloorRowModel({ ...state, floors }, 3).displayHeight).toBeNull();
  });

  it('falls back to the stored height when an elevation is missing', () => {
    const state = makeFloorsState();
    const floors = state.floors.map((f) => (f.id === 'f-1' ? { ...f, elevation: null } : f));
    expect(buildFloorRowModel({ ...state, floors }, 1).derivedHeight).toBe(9.99);
  });

  it('marks special levels, and only those', () => {
    const state = makeFloorsState();
    expect(buildFloorRowModel(state, 0).isSpecial).toBe(true);
    expect(buildFloorRowModel(state, 1).isSpecial).toBe(false);
  });

  it('flags a storey with no height as an error, not as a value', () => {
    const state = makeFloorsState();
    expect(buildFloorRowModel(state, 2).isTooLow).toBe(true);
    expect(buildFloorRowModel(state, 1).isTooLow).toBe(false);
  });

  it('reads expanded / editing / highlighted from the state ids', () => {
    const row = buildFloorRowModel(
      makeFloorsState({ expandedFloorId: 'f-0', editingId: 'f-0', highlightedFloorId: 'f-0' }),
      1,
    );
    expect([row.isExpanded, row.isEditing, row.isHighlighted]).toEqual([true, true, true]);
    const other = buildFloorRowModel(makeFloorsState({ expandedFloorId: 'f-0' }), 2);
    expect([other.isExpanded, other.isEditing, other.isHighlighted]).toEqual([false, false, false]);
  });
});

describe('floorRowTone', () => {
  it('ranks deep-link highlight above expanded above hover', () => {
    const highlighted = buildFloorRowModel(makeFloorsState({ highlightedFloorId: 'f-0', expandedFloorId: 'f-0' }), 1);
    const expanded = buildFloorRowModel(makeFloorsState({ expandedFloorId: 'f-0' }), 1);
    const idle = buildFloorRowModel(makeFloorsState(), 1);
    expect(floorRowTone(highlighted)).toContain('--bg-info');
    expect(floorRowTone(expanded)).toBe('bg-muted/10');
    expect(floorRowTone(idle)).toBe('hover:bg-muted/20');
  });
});
