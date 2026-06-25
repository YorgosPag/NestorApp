/**
 * ADR-363 Phase 4 — Column Tool **state-mutation actions** (N.7.1 file-size split από `useColumnTool.ts`).
 *
 * Καθαροί state reducers του εργαλείου Κολώνα (lifecycle + ribbon setters): `activate`, `setKind`,
 * `setPlacementMode`, `setRegionMethod`, `setDiscreteIntent`, `setAnchor`, `cycleAnchor`, `deactivate`,
 * `reset`, `setParamOverrides`, `setSlantMode`. Δεν αγγίζουν commit/click — μόνο `setState` +
 * lock-cleanup stores. Ο orchestrator (`useColumnTool`) τα συνθέτει με τα commit/click pipelines.
 *
 * @see ./useColumnTool.ts — orchestrator consumer
 * @see ./column-tool-types.ts — state machine types + INITIAL_STATE
 */

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import {
  ANCHOR_CYCLE_ORDER,
  type ColumnAnchor,
  type ColumnKind,
} from '../../bim/types/column-types';
import { type ColumnParamOverrides } from './column-completion';
import type { RegionMethod } from '../../systems/tools/region-tool-ids';
import { clearColumnRotationLock } from '../../systems/cursor/ColumnRotationStore';
import { clearColumnTopLeanLock } from '../../systems/cursor/ColumnTopLeanStore';
import { sceneSnapTargetsStore } from '../../bim/framing/scene-snap-targets';
import {
  INITIAL_STATE,
  type ColumnPlacementMode,
  type ColumnToolState,
} from './column-tool-types';

/** Το σύνολο των state-mutation actions που επιστρέφει ο hook (ίδιες υπογραφές με πριν). */
export interface ColumnToolStateActions {
  readonly activate: () => void;
  readonly setKind: (kind: ColumnKind) => void;
  readonly setPlacementMode: (mode: ColumnPlacementMode) => void;
  readonly setRegionMethod: (regionMethod: RegionMethod) => void;
  readonly setDiscreteIntent: (discreteIntent: 'columns' | 'walls') => void;
  readonly setAnchor: (anchor: ColumnAnchor) => void;
  readonly cycleAnchor: (direction?: 1 | -1) => void;
  readonly deactivate: () => void;
  readonly reset: () => void;
  readonly setParamOverrides: (overrides: ColumnParamOverrides) => void;
  readonly setSlantMode: (slantMode: boolean) => void;
}

/**
 * Χτίζει τα state-mutation actions του εργαλείου Κολώνα. `setState` (σταθερό από `useState`) +
 * `refreshSnapTargets` (σταθερό από `useSceneSnapTargetSync`) → τα callbacks διατηρούν ταυτότητα
 * (ίδια dependency arrays με την προηγούμενη inline μορφή· μηδέν regression στα re-renders).
 */
export function useColumnToolStateActions(
  setState: Dispatch<SetStateAction<ColumnToolState>>,
  refreshSnapTargets: () => void,
): ColumnToolStateActions {
  // ── lifecycle ────────────────────────────────────────────────────────────
  const activate = useCallback(() => {
    refreshSnapTargets(); // στόχοι έτοιμοι πριν το 1ο ghost frame
    setState((prev) => ({
      ...INITIAL_STATE,
      kind: prev.kind,
      anchor: prev.anchor,
      placementMode: prev.placementMode,
      regionMethod: prev.regionMethod,
      discreteIntent: prev.discreteIntent,
      slantMode: prev.slantMode,
      overrides: prev.overrides,
      phase: 'awaitingPosition',
    }));
  }, [refreshSnapTargets, setState]);

  const setKind = useCallback((kind: ColumnKind) => {
    setState((prev) => ({
      ...INITIAL_STATE,
      kind,
      anchor: prev.anchor,
      placementMode: prev.placementMode,
      regionMethod: prev.regionMethod,
      discreteIntent: prev.discreteIntent,
      slantMode: prev.slantMode,
      overrides: prev.overrides,
      phase: prev.phase === 'idle' ? 'idle' : 'awaitingPosition',
    }));
  }, [setState]);

  // ADR-363 Φάση 3 — switch placement mode (freehand ⇄ outer-perimeter). Resets
  // the state machine (κρατά kind + anchor + overrides). No-op όταν δεν αλλάζει.
  const setPlacementMode = useCallback((mode: ColumnPlacementMode) => {
    setState((prev) => {
      if (prev.placementMode === mode) return prev;
      return {
        ...INITIAL_STATE,
        kind: prev.kind,
        anchor: prev.anchor,
        overrides: prev.overrides,
        regionMethod: prev.regionMethod,
        discreteIntent: prev.discreteIntent,
        slantMode: prev.slantMode,
        placementMode: mode,
        phase: prev.phase === 'idle' ? 'idle' : 'awaitingPosition',
      };
    });
  }, [setState]);

  // ADR-419 — set the in-region method ('lines' | 'inside' | 'box'). Driven by the
  // active tool id (column-region-lines/inside/box). Clears accumulated picks on change.
  const setRegionMethod = useCallback((regionMethod: RegionMethod) => {
    setState((prev) =>
      prev.regionMethod === regionMethod ? prev : { ...prev, regionMethod, regionPicks: [] },
    );
  }, [setState]);

  // ADR-419 — set the discrete-from-perimeter intent ('columns' | 'walls'). Driven by
  // the active tool id (column-discrete-from-perimeter vs …-walls).
  const setDiscreteIntent = useCallback((discreteIntent: 'columns' | 'walls') => {
    setState((prev) => (prev.discreteIntent === discreteIntent ? prev : { ...prev, discreteIntent }));
  }, [setState]);

  const setAnchor = useCallback((anchor: ColumnAnchor) => {
    setState((prev) => ({ ...prev, anchor }));
  }, [setState]);

  const cycleAnchor = useCallback((direction: 1 | -1 = 1) => {
    setState((prev) => {
      const idx = ANCHOR_CYCLE_ORDER.indexOf(prev.anchor);
      const len = ANCHOR_CYCLE_ORDER.length;
      const nextIdx = (idx + direction + len) % len;
      return { ...prev, anchor: ANCHOR_CYCLE_ORDER[nextIdx] };
    });
  }, [setState]);

  const deactivate = useCallback(() => {
    clearColumnRotationLock(); // ADR-508 §column place+rotate — ακύρωση τυχόν ενεργού rotation
    clearColumnTopLeanLock(); // ADR-404 Φ5 — ακύρωση τυχόν ενεργού slant 2-click
    sceneSnapTargetsStore.reset(); // ADR-398 §3.10 — καθάρισε τους face-snap στόχους
    setState(INITIAL_STATE);
  }, [setState]);

  const reset = useCallback(() => {
    clearColumnRotationLock(); // ESC κατά το awaitingRotation → επιστροφή σε awaitingPosition
    clearColumnTopLeanLock(); // ESC κατά το awaitingTopLean → επιστροφή σε awaitingPosition
    setState((prev) => ({
      ...INITIAL_STATE,
      kind: prev.kind,
      anchor: prev.anchor,
      placementMode: prev.placementMode,
      regionMethod: prev.regionMethod,
      discreteIntent: prev.discreteIntent,
      slantMode: prev.slantMode,
      overrides: prev.overrides,
      phase: prev.phase === 'idle' ? 'idle' : 'awaitingPosition',
    }));
  }, [setState]);

  const setParamOverrides = useCallback((overrides: ColumnParamOverrides) => {
    setState((prev) => ({ ...prev, overrides: { ...prev.overrides, ...overrides } }));
  }, [setState]);

  // ADR-404 Φ5 — ribbon toggle «Κεκλιμένη». Αλλαγή mode → ακύρωση τυχόν ενεργού 2-click
  // (rotation ή top-lean) ώστε να μην μείνει «μισό» κλικ από προηγούμενο mode.
  const setSlantMode = useCallback((slantMode: boolean) => {
    setState((prev) => {
      if (prev.slantMode === slantMode) return prev;
      clearColumnRotationLock();
      clearColumnTopLeanLock();
      return {
        ...prev,
        slantMode,
        phase: prev.phase === 'idle' ? 'idle' : 'awaitingPosition',
        error: null,
      };
    });
  }, [setState]);

  return {
    activate,
    setKind,
    setPlacementMode,
    setRegionMethod,
    setDiscreteIntent,
    setAnchor,
    cycleAnchor,
    deactivate,
    reset,
    setParamOverrides,
    setSlantMode,
  };
}
