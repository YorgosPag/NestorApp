// ============================================================================
// ADR-532 Stage B — legacy mirror round-trip.
// The provider (useSelectionSystemState) registers the store-owned legacy sink;
// a DIRECT SelectedEntitiesStore mutation must flow through it into the reducer's
// `selectedRegionIds` (overlay-only projection) + region-edit reset — proving an
// orchestrator can mutate the store imperatively without the mirror going stale.
// ============================================================================

import { act, renderHook } from '@testing-library/react';

import { useSelectionSystemState } from '../useSelectionSystemState';
import { SelectedEntitiesStore } from '../SelectedEntitiesStore';

beforeEach(() => {
  SelectedEntitiesStore._resetForTests();
});

describe('selection legacy mirror (store-owned sink → reducer)', () => {
  it('direct overlay select mirrors into selectedRegionIds', () => {
    const { result } = renderHook(() => useSelectionSystemState());
    expect(result.current.state.selectedRegionIds).toEqual([]);

    act(() => { SelectedEntitiesStore.selectEntity({ id: 'ov', type: 'overlay' }); });
    expect(result.current.state.selectedRegionIds).toEqual(['ov']);
  });

  it('dxf-entity select resets region-edit but leaves selectedRegionIds untouched', () => {
    const { result } = renderHook(() => useSelectionSystemState());
    act(() => { SelectedEntitiesStore.selectEntity({ id: 'ov', type: 'overlay' }); });
    expect(result.current.state.selectedRegionIds).toEqual(['ov']);

    // Stage editing state, then a dxf-entity SELECT (resetEditing:true, regionIds unchanged).
    act(() => { result.current.contextValue.setEditingRegion('ov'); });
    expect(result.current.state.editingRegionId).toBe('ov');
    act(() => { SelectedEntitiesStore.selectEntity({ id: 'dx', type: 'dxf-entity' }); });
    expect(result.current.state.selectedRegionIds).toEqual(['ov']); // overlay projection kept
    expect(result.current.state.editingRegionId).toBeNull();        // editing reset
  });

  it('dxf-entity select with NO active region-editing keeps state referentially stable (idempotent reducer — no SelectionContext churn)', () => {
    const { result } = renderHook(() => useSelectionSystemState());
    // No overlay selected, no editing/dragging staged → edit flags already null.
    const before = result.current.state;
    act(() => { SelectedEntitiesStore.selectEntity({ id: 'dx', type: 'dxf-entity' }); });
    // SYNC_UNIVERSAL_LEGACY fired (resetEditing:true) but nothing actually changed →
    // reducer must return the SAME reference, so the memoized context value does not rebuild.
    expect(result.current.state).toBe(before);
  });

  it('dxf-entity add does NOT dispatch (NO_MIRROR) — region state stays referentially stable', () => {
    const { result } = renderHook(() => useSelectionSystemState());
    const before = result.current.state;
    act(() => { SelectedEntitiesStore.addEntity({ id: 'dx', type: 'dxf-entity' }); });
    expect(result.current.state).toBe(before); // no reducer dispatch → same state object
  });

  it('clearAll clears the overlay projection', () => {
    const { result } = renderHook(() => useSelectionSystemState());
    act(() => { SelectedEntitiesStore.selectEntity({ id: 'ov', type: 'overlay' }); });
    expect(result.current.state.selectedRegionIds).toEqual(['ov']);
    act(() => { SelectedEntitiesStore.clearAll(); });
    expect(result.current.state.selectedRegionIds).toEqual([]);
  });
});
