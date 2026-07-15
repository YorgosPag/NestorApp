/**
 * ADR-402 Phase C — Selection3DStore multi-select.
 * Verifies replace (plain click) vs toggle (Shift+click), the derived primary
 * compat fields, and primary promotion when the first id is removed.
 */

import { useSelection3DStore } from '../Selection3DStore';

beforeEach(() => {
  useSelection3DStore.getState().clearSelection();
});

describe('Selection3DStore — multi-select', () => {
  it('selectEntity replaces the selection with a single entity', () => {
    const s = useSelection3DStore.getState();
    s.selectEntity('a', 'wall');
    s.selectEntity('b', 'column');
    const st = useSelection3DStore.getState();
    expect(st.selectedBimIds).toEqual(['b']);
    expect(st.selectedBimId).toBe('b');
    expect(st.selectedBimType).toBe('column');
  });

  it('toggleEntity adds then removes (Shift+click)', () => {
    const s = useSelection3DStore.getState();
    s.selectEntity('a', 'wall');
    s.toggleEntity('b', 'column');
    expect(useSelection3DStore.getState().selectedBimIds).toEqual(['a', 'b']);
    s.toggleEntity('a', 'wall');
    expect(useSelection3DStore.getState().selectedBimIds).toEqual(['b']);
  });

  it('derives primary fields from the first selected entity', () => {
    const s = useSelection3DStore.getState();
    s.selectEntity('a', 'wall');
    s.toggleEntity('b', 'column');
    expect(useSelection3DStore.getState().selectedBimId).toBe('a');
    expect(useSelection3DStore.getState().selectedBimType).toBe('wall');
    // Removing the primary promotes the next id to primary.
    s.toggleEntity('a', 'wall');
    expect(useSelection3DStore.getState().selectedBimId).toBe('b');
    expect(useSelection3DStore.getState().selectedBimType).toBe('column');
  });

  it('toggling the last entity off clears the primary to null', () => {
    const s = useSelection3DStore.getState();
    s.selectEntity('a', 'wall');
    s.toggleEntity('a', 'wall');
    const st = useSelection3DStore.getState();
    expect(st.selectedBimIds).toEqual([]);
    expect(st.selectedBimId).toBeNull();
    expect(st.selectedBimType).toBeNull();
  });

  it('setSelection replaces with an explicit multi-set and derives the primary (ADR-402/532 hydration)', () => {
    const s = useSelection3DStore.getState();
    s.selectEntity('x', 'slab'); // prior selection is fully replaced
    s.setSelection(['a', 'b'], { a: 'wall', b: 'column' });
    const st = useSelection3DStore.getState();
    expect(st.selectedBimIds).toEqual(['a', 'b']);
    expect(st.selectedBimTypes).toEqual({ a: 'wall', b: 'column' });
    expect(st.selectedBimId).toBe('a');
    expect(st.selectedBimType).toBe('wall');
    // Empty set clears back to null primary.
    s.setSelection([], {});
    expect(useSelection3DStore.getState().selectedBimIds).toEqual([]);
    expect(useSelection3DStore.getState().selectedBimId).toBeNull();
  });

  it('clearSelection empties everything', () => {
    const s = useSelection3DStore.getState();
    s.selectEntity('a', 'wall');
    s.toggleEntity('b', 'column');
    s.clearSelection();
    const st = useSelection3DStore.getState();
    expect(st.selectedBimIds).toEqual([]);
    expect(st.selectedBimTypes).toEqual({});
    expect(st.selectedBimId).toBeNull();
    expect(st.selectedBimType).toBeNull();
  });
});
