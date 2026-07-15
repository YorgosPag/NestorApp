/**
 * ADR-402/532 — 3D→universal selection bridge, cross-mode round-trip.
 *
 * Guards the «select in 3D → back to 2D → still selected» contract:
 *  - a SUPPRESSED teardown clear (BimViewport3D unmount) never wipes the universal selection,
 *  - the mode-guard (mode==='2d') is a second safety net for the same teardown clear,
 *  - a GENUINE in-3D clear (mode≠'2d', not suppressed) still propagates to the universal truth.
 */

import * as React from 'react';
import { renderHook } from '@testing-library/react';
import {
  use3DSelectionUniversalBridge,
  withSuppressed3DToUniversalSync,
} from '../use-3d-selection-universal-bridge';
import { SelectionSystem } from '../../../../systems/selection/SelectionSystem';
import { SelectedEntitiesStore } from '../../../../systems/selection/SelectedEntitiesStore';
import { useSelection3DStore } from '../../../stores/Selection3DStore';
import { useViewMode3DStore } from '../../../stores/ViewMode3DStore';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SelectionSystem>{children}</SelectionSystem>
);

function setMode(mode: '2d' | '3d-raster'): void {
  useViewMode3DStore.setState((s) => {
    s.mode = mode;
  });
}

beforeEach(() => {
  SelectedEntitiesStore.clearAll();
  useSelection3DStore.getState().clearSelection();
  setMode('3d-raster');
});

describe('use3DSelectionUniversalBridge — cross-mode round-trip', () => {
  it('a raw DXF selection survives a SUPPRESSED teardown clear (the polyline bug)', () => {
    renderHook(() => use3DSelectionUniversalBridge(), { wrapper });

    // A polyline picked in 3D writes the universal store directly (use-bim3d-pointer-handlers).
    SelectedEntitiesStore.replaceEntitySelection(['polyline-1']);
    expect(SelectedEntitiesStore.getSelectedEntityIds()).toEqual(['polyline-1']);

    // BimViewport3D unmount resets local 3D state, wrapped in the suppress guard.
    withSuppressed3DToUniversalSync(() => useSelection3DStore.getState().clearSelection());

    expect(SelectedEntitiesStore.getSelectedEntityIds()).toEqual(['polyline-1']); // preserved
  });

  it('mode-guard: an unguarded clear while mode=2d does NOT propagate (teardown safety net)', () => {
    renderHook(() => use3DSelectionUniversalBridge(), { wrapper });

    // A BIM wall selected in 3D mirrors into the universal store via the bridge.
    useSelection3DStore.getState().setSelection(['wall-1'], { 'wall-1': 'wall' });
    expect(SelectedEntitiesStore.getSelectedEntityIds()).toEqual(['wall-1']);

    setMode('2d'); // returned to 2D
    useSelection3DStore.getState().clearSelection(); // unguarded teardown clear
    expect(SelectedEntitiesStore.getSelectedEntityIds()).toEqual(['wall-1']); // preserved
  });

  it('a genuine in-3D deselect (mode=3d, not suppressed) still propagates', () => {
    renderHook(() => use3DSelectionUniversalBridge(), { wrapper });

    useSelection3DStore.getState().setSelection(['wall-1'], { 'wall-1': 'wall' });
    expect(SelectedEntitiesStore.getSelectedEntityIds()).toEqual(['wall-1']);

    // Click empty space in 3D → deselect while 3D is active → SHOULD clear the universal too.
    useSelection3DStore.getState().clearSelection();
    expect(SelectedEntitiesStore.getSelectedEntityIds()).toEqual([]);
  });
});
