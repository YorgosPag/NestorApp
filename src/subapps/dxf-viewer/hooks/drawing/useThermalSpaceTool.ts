/**
 * ADR-422 L0 — Thermal-Space Tool React Hook Orchestrator (Revit «Place Space»).
 *
 * Click-in-region gesture (ΟΧΙ multi-vertex polygon όπως floor-finish): ο χρήστης
 * κλικάρει ΜΕΣΑ σε δωμάτιο → το footprint πολύγωνο παράγεται από τον μικρότερο
 * κλειστό βρόχο τοίχων που το περικλείει. Επομένως ΔΕΝ υπάρχει rubber-band preview
 * (κανένα preview-store).
 *
 * State machine: idle ⇄ awaiting (continuous — μετά από commit μένει ενεργό για
 * τον επόμενο χώρο).
 *
 * SSoT alignment (FULL reuse — ADR-419 region path):
 *   - `getCachedRegionPerimeters` + `pickSmallestContainingPerimeter` +
 *     `isPerimeterOversized` + `findOpenChainLineIdsNear` (perimeter-from-faces).
 *   - `resolveRegionLoopTolWorld` (region-tolerance) για gap-closure tolerance.
 *   - Entity build μέσω `buildDefaultThermalSpaceParams`/`buildThermalSpaceEntity`
 *     (thermal-space-completion). ZERO duplicate construction.
 *   - Active-tool string `'thermal-space'` — ο orchestrator (useSpecialTools)
 *     ενεργοποιεί μέσω `useToolLifecycle(activeTool === 'thermal-space', ...)`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md
 * @see hooks/drawing/use-wall-region-clicks.ts — το click-in-region πρότυπο
 */

import { useCallback, useRef, useState } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type { ThermalSpaceEntity } from '../../bim/types/thermal-space-types';
import {
  buildDefaultThermalSpaceParams,
  buildThermalSpaceEntity,
  type ThermalSpaceParamOverrides,
  type SceneUnits,
} from './thermal-space-completion';
import { DEFAULT_THERMAL_SPACE_CEILING_HEIGHT_MM } from '../../bim/types/thermal-space-types';
import { pickValidatedRegionForClick } from '../../bim/walls/pick-region-for-tool';

// ─── State machine types ─────────────────────────────────────────────────────

export type ThermalSpaceToolPhase = 'idle' | 'awaiting';

export interface ThermalSpaceToolState {
  readonly phase: ThermalSpaceToolPhase;
  readonly overrides: ThermalSpaceParamOverrides;
  readonly error: string | null;
}

const INITIAL_STATE: ThermalSpaceToolState = {
  phase: 'idle',
  overrides: {},
  error: null,
};

/**
 * Symmetry constant με τα άλλα area tools (floor-finish/underfloor) — αυτός ο
 * tool ΔΕΝ κάνει auto-close (click-in-region), αλλά το export κρατά το lifecycle
 * wiring στο useSpecialTools ομοιόμορφο.
 */
export const THERMAL_SPACE_AUTO_CLOSE_TOLERANCE_DEFAULT = 50;

// ─── Hook options + return ───────────────────────────────────────────────────

export interface UseThermalSpaceToolOptions {
  readonly onThermalSpaceCreated?: (entity: ThermalSpaceEntity) => void;
  readonly currentLevelId?: string;
  /** Returns the active scene entities (DXF + BIM) for region detection. */
  readonly getSceneEntities?: () => readonly Entity[];
  /** Returns the active scene's coordinate units. */
  readonly getSceneUnits?: () => SceneUnits;
  /** Returns the storey clear height (mm) for the space volume. Default 3000. */
  readonly getCeilingHeightMm?: () => number;
}

export interface UseThermalSpaceToolResult {
  readonly state: ThermalSpaceToolState;
  activate(): void;
  deactivate(): void;
  reset(): void;
  /** Returns true αν το click δημιούργησε χώρο ή κατανάλωσε το event (warning). */
  onCanvasClick(point: Readonly<Point2D>): boolean;
  setParamOverrides(overrides: ThermalSpaceParamOverrides): void;
  getStatusText(): string;
  readonly isActive: boolean;
}

// ─── Hook implementation ─────────────────────────────────────────────────────

export function useThermalSpaceTool(
  options: UseThermalSpaceToolOptions = {},
): UseThermalSpaceToolResult {
  const {
    onThermalSpaceCreated,
    currentLevelId = '0',
    getSceneEntities,
    getSceneUnits,
    getCeilingHeightMm,
  } = options;

  const [state, setState] = useState<ThermalSpaceToolState>(INITIAL_STATE);
  const stateRef = useRef<ThermalSpaceToolState>(state);
  stateRef.current = state;

  const activate = useCallback(() => {
    setState((prev) => ({ ...INITIAL_STATE, overrides: prev.overrides, phase: 'awaiting' }));
  }, []);

  const deactivate = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const reset = useCallback(() => {
    setState((prev) => ({
      ...INITIAL_STATE,
      overrides: prev.overrides,
      phase: prev.phase === 'idle' ? 'idle' : 'awaiting',
    }));
  }, []);

  const setParamOverrides = useCallback((overrides: ThermalSpaceParamOverrides) => {
    setState((prev) => ({ ...prev, overrides: { ...prev.overrides, ...overrides } }));
  }, []);

  const onCanvasClick = useCallback(
    (point: Readonly<Point2D>): boolean => {
      const s = stateRef.current;
      if (s.phase !== 'awaiting') return false;

      const entities = getSceneEntities?.() ?? [];
      const sceneUnits: SceneUnits = getSceneUnits?.() ?? 'mm';

      // Κοινό SSoT με το hover + bathroom-auto-arrange: pick → open-loop diagnostics → oversized guard.
      const outcome = pickValidatedRegionForClick(point, entities, sceneUnits);
      if (outcome.status !== 'picked') return outcome.status === 'consumed';
      const pick = outcome.perimeter;

      const ceilingHeightMm = getCeilingHeightMm?.() ?? DEFAULT_THERMAL_SPACE_CEILING_HEIGHT_MM;
      const params = buildDefaultThermalSpaceParams(
        [...pick.polygon],
        s.overrides,
        sceneUnits,
        ceilingHeightMm,
      );
      const result = buildThermalSpaceEntity(params, currentLevelId);
      if (!result.ok) {
        setState({ ...s, error: result.hardErrors[0] ?? null });
        return true;
      }
      onThermalSpaceCreated?.(result.entity);
      // Continuous — stay awaiting for the next room.
      setState({ ...INITIAL_STATE, overrides: s.overrides, phase: 'awaiting' });
      return true;
    },
    [getSceneEntities, getSceneUnits, getCeilingHeightMm, currentLevelId, onThermalSpaceCreated],
  );

  const getStatusText = useCallback((): string => {
    return stateRef.current.phase === 'awaiting' ? 'tools.thermalSpace.statusPlace' : '';
  }, []);

  return {
    state,
    activate,
    deactivate,
    reset,
    onCanvasClick,
    setParamOverrides,
    getStatusText,
    isActive: state.phase !== 'idle',
  };
}
