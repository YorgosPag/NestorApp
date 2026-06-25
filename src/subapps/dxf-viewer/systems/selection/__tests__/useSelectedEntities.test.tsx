// ============================================================================
// useSelectedEntities — leaf hook tests (ADR-532)
// Verify the useSyncExternalStore hooks react to store mutations + stay stable.
// ============================================================================

import { act, renderHook } from '@testing-library/react';

import { SelectedEntitiesStore } from '../SelectedEntitiesStore';
import {
  useSelectedEntityIds,
  usePrimarySelectedId,
  useIsSelected,
  useSelectionCount,
  useSelectionByType,
} from '../useSelectedEntities';

beforeEach(() => {
  SelectedEntitiesStore._resetForTests();
});

describe('useSelectedEntities — reactivity', () => {
  it('useSelectedEntityIds reflects store mutations', () => {
    const { result } = renderHook(() => useSelectedEntityIds());
    expect(result.current).toEqual([]);
    act(() => { SelectedEntitiesStore.addEntity({ id: 'a', type: 'dxf-entity' }); });
    expect(result.current).toEqual(['a']);
  });

  it('usePrimarySelectedId is value-stable (no new render when unchanged)', () => {
    let renders = 0;
    const { result } = renderHook(() => { renders += 1; return usePrimarySelectedId(); });
    act(() => { SelectedEntitiesStore.selectEntity({ id: 'a', type: 'dxf-entity' }); });
    expect(result.current).toBe('a');
    const rendersAfterSelect = renders;
    // A mutation that does NOT change the primary must not re-render this leaf.
    act(() => { SelectedEntitiesStore.addEntity({ id: 'a', type: 'dxf-entity' }); });
    expect(result.current).toBe('a');
    expect(renders).toBe(rendersAfterSelect);
  });

  it('useIsSelected tracks a single id', () => {
    const { result } = renderHook(() => useIsSelected('target'));
    expect(result.current).toBe(false);
    act(() => { SelectedEntitiesStore.addEntity({ id: 'target', type: 'dxf-entity' }); });
    expect(result.current).toBe(true);
  });

  it('useSelectionCount tracks total size', () => {
    const { result } = renderHook(() => useSelectionCount());
    act(() => {
      SelectedEntitiesStore.addEntities([
        { id: 'a', type: 'dxf-entity' },
        { id: 'b', type: 'overlay' },
      ]);
    });
    expect(result.current).toBe(2);
  });

  it('useSelectionByType returns the per-type id list (overlay absorbs region)', () => {
    const { result } = renderHook(() => useSelectionByType('overlay'));
    act(() => {
      SelectedEntitiesStore.addEntity({ id: 'ov', type: 'overlay' });
      SelectedEntitiesStore.addEntity({ id: 'rg', type: 'region' });
    });
    expect([...result.current].sort()).toEqual(['ov', 'rg']);
  });
});
