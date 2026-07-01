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

  it('adopts just the hovered entity when it is NOT selected (Figma-style)', () => {
    const result = resolveBodyDragTarget({
      hoveredEntityId: 'c',
      isSelected: (id) => id === 'a',
      selectedIds: ['a'],
    });
    expect(result).toEqual(['c']);
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
});
