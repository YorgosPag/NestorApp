'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { type DisplayUnit } from '../../config/units';
import { displayUnitState } from '../../config/display-unit-state';
import { markAllCanvasDirty } from '../../rendering/core/UnifiedFrameScheduler';

export interface UseDisplayUnitResult {
  displayUnit: DisplayUnit;
  setDisplayUnit: (unit: DisplayUnit) => void;
}

/**
 * ADR-357 Phase 2b: React binding for the user-selected display unit.
 *
 * Subscribes to the non-React `displayUnitState` SSoT (single live truth shared
 * with the canvas render-path formatter `formatLengthMm`). Writes go through the
 * store, which persists to localStorage (key: dxf:displayUnit) and notifies every
 * subscriber synchronously → the status-bar selector and all readouts stay in
 * lock-step. Defaults to 'cm'.
 *
 * @see config/display-unit-state.ts — the store this binds to
 */
export function useDisplayUnit(): UseDisplayUnitResult {
  const displayUnit = useSyncExternalStore(
    displayUnitState.subscribe,
    displayUnitState.getUnit,
    displayUnitState.getUnit,
  );

  const setDisplayUnit = useCallback((unit: DisplayUnit) => {
    displayUnitState.setUnit(unit);
    // Live refresh: the canvas readouts (ruler ticks, dimension pills, move /
    // drag-measurement labels) are drawn on-demand (ADR-040) — repaint all canvas
    // layers so every label switches to the new unit immediately, Revit-style.
    markAllCanvasDirty();
  }, []);

  return { displayUnit, setDisplayUnit };
}
