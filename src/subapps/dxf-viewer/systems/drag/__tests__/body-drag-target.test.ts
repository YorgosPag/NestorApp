/**
 * Tests — resolveBodyDragTarget (body-drag mousedown gate).
 */
import { resolveBodyDragTarget } from '../body-drag-target';

describe('resolveBodyDragTarget', () => {
  it('returns null when no entity is under the cursor (→ lasso)', () => {
    const result = resolveBodyDragTarget({
      hoveredEntityId: null,
      isSelected: () => false,
      selectedIds: ['a', 'b'],
    });
    expect(result).toBeNull();
  });

  it('drags the WHOLE selection when the hovered entity is selected', () => {
    const result = resolveBodyDragTarget({
      hoveredEntityId: 'b',
      isSelected: (id) => id === 'a' || id === 'b',
      selectedIds: ['a', 'b'],
    });
    expect(result).toEqual(['a', 'b']);
  });

  it('returns null when the hovered entity is NOT selected (select-first → click-select falls through)', () => {
    const result = resolveBodyDragTarget({
      hoveredEntityId: 'c',
      isSelected: (id) => id === 'a',
      selectedIds: ['a'],
    });
    expect(result).toBeNull();
  });

  it('falls back to [hovered] when it is selected but the selection list is empty', () => {
    const result = resolveBodyDragTarget({
      hoveredEntityId: 'x',
      isSelected: () => true,
      selectedIds: [],
    });
    expect(result).toEqual(['x']);
  });

  it('returns a fresh array copy of the selection (no aliasing)', () => {
    const selectedIds = ['a', 'b'];
    const result = resolveBodyDragTarget({
      hoveredEntityId: 'a',
      isSelected: () => true,
      selectedIds,
    });
    expect(result).toEqual(['a', 'b']);
    expect(result).not.toBe(selectedIds);
  });

  /**
   * 🔴 ADR-739 §27.15 — a table under cell-edit turns its body into a GRID.
   *
   * Without this gate, Excel-style drag-selection inside a table would *also* move the
   * table: the body-drag arms at 3 px and the table's pointer listener is deliberately
   * passive (it never calls `stopPropagation`, or it would break grip drag / marquee).
   * The claim is the only thing standing between "select cells" and "corrupt the drawing".
   */
  describe('§27.15 — a press claimed by the in-place cell editor never moves the body', () => {
    it('returns null even when the hovered entity IS selected', () => {
      expect(
        resolveBodyDragTarget({
          hoveredEntityId: 'table-1',
          isSelected: () => true,
          selectedIds: ['table-1'],
          claimedByCellEditor: true,
        }),
      ).toBeNull();
    });

    it('🔴 the claim beats the WHOLE selection, not just the hovered entity', () => {
      expect(
        resolveBodyDragTarget({
          hoveredEntityId: 'table-1',
          isSelected: () => true,
          selectedIds: ['table-1', 'wall-7', 'slab-3'],
          claimedByCellEditor: true,
        }),
      ).toBeNull();
    });

    it('absent / false claim leaves the existing behaviour untouched', () => {
      const input = {
        hoveredEntityId: 'table-1',
        isSelected: () => true,
        selectedIds: ['table-1'],
      };
      expect(resolveBodyDragTarget(input)).toEqual(['table-1']);
      expect(resolveBodyDragTarget({ ...input, claimedByCellEditor: false })).toEqual(['table-1']);
    });
  });
});
