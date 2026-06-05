/**
 * ADR-408 Εύρος Β #1 — Heating Radiator Tool React Hook Orchestrator.
 *
 * State machine:
 *   idle → awaitingPosition → committed → awaitingPosition (continuous)
 *
 * Single-click placement (Revit family placement): user picks the radiator tool →
 * clicks to place at the cursor point → continuous chain. ESC resets (handled
 * centrally by EscapeCommandBus, like the manifold/fixture/column tools).
 *
 * SSoT alignment:
 *   - Entity build via `buildMepRadiatorEntity` / `buildDefaultMepRadiatorParams`
 *     (`mep-radiator-completion.ts`).
 *   - 3D placement bridge via `bim:place-mep-radiator-3d` → same `onCanvasClick`.
 *   - ADR-040 micro-leaf compliance: hook owns React state, no
 *     `useSyncExternalStore` against high-frequency stores.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import {
  buildDefaultMepRadiatorParams,
  buildMepRadiatorEntity,
  type MepRadiatorParamOverrides,
  type SceneUnits,
} from './mep-radiator-completion';
import { computeMepRadiatorGeometry } from '../../bim/mep-radiators/mep-radiator-geometry';
import type { MepRadiatorEntity } from '../../bim/types/mep-radiator-types';
import { mepRadiatorToolBridgeStore } from '../../ui/ribbon/hooks/bridge/mep-radiator-tool-bridge-store';
import { EventBus } from '../../systems/events/EventBus';

// ─── State machine types ─────────────────────────────────────────────────────

export type MepRadiatorToolPhase = 'idle' | 'awaitingPosition' | 'committed';

export interface MepRadiatorToolState {
  readonly phase: MepRadiatorToolPhase;
  readonly overrides: MepRadiatorParamOverrides;
  readonly error: string | null;
}

const INITIAL_STATE: MepRadiatorToolState = {
  phase: 'idle',
  overrides: {},
  error: null,
};

// ─── Hook options + return ───────────────────────────────────────────────────

export interface UseMepRadiatorToolOptions {
  readonly onMepRadiatorCreated?: (entity: MepRadiatorEntity) => void;
  readonly currentLevelId?: string;
  readonly getSceneUnits?: () => SceneUnits;
}

export interface UseMepRadiatorToolResult {
  readonly state: MepRadiatorToolState;
  activate(): void;
  setParamOverrides(overrides: MepRadiatorParamOverrides): void;
  deactivate(): void;
  reset(): void;
  /** Returns true when the click committed a new radiator. */
  onCanvasClick(point: Readonly<Point2D>): boolean;
  getStatusText(): string;
  /**
   * Footprint preview at `cursorPos` (world canvas units), or null when not
   * awaiting a position. Pure projection — no state mutation (ADR-040).
   */
  getGhostFootprint(cursorPos: Readonly<Point2D> | null): readonly Point3D[] | null;
  readonly isActive: boolean;
  readonly isAwaitingPosition: boolean;
}

// ─── Hook implementation ─────────────────────────────────────────────────────

export function useMepRadiatorTool(
  options: UseMepRadiatorToolOptions = {},
): UseMepRadiatorToolResult {
  const { onMepRadiatorCreated, currentLevelId = '0', getSceneUnits } = options;

  const [state, setState] = useState<MepRadiatorToolState>(INITIAL_STATE);
  const stateRef = useRef<MepRadiatorToolState>(state);
  stateRef.current = state;
  const getSceneUnitsRef = useRef(getSceneUnits);
  getSceneUnitsRef.current = getSceneUnits;
  const onCreatedRef = useRef(onMepRadiatorCreated);
  onCreatedRef.current = onMepRadiatorCreated;

  const activate = useCallback(() => {
    setState((prev) => ({ ...INITIAL_STATE, overrides: prev.overrides, phase: 'awaitingPosition' }));
  }, []);

  const setParamOverrides = useCallback((overrides: MepRadiatorParamOverrides) => {
    setState((prev) => ({ ...prev, overrides: { ...prev.overrides, ...overrides } }));
  }, []);

  const deactivate = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const reset = useCallback(() => {
    setState((prev) => ({
      ...INITIAL_STATE,
      overrides: prev.overrides,
      phase: prev.phase === 'idle' ? 'idle' : 'awaitingPosition',
    }));
  }, []);

  const commitFromState = useCallback(
    (s: MepRadiatorToolState, clickPoint: Readonly<Point2D>): boolean => {
      const sceneUnits = getSceneUnitsRef.current?.() ?? 'mm';
      const params = buildDefaultMepRadiatorParams(clickPoint, s.overrides, sceneUnits);
      const result = buildMepRadiatorEntity(params, currentLevelId);
      if (!result.ok) {
        setState({ ...s, error: result.hardErrors[0] ?? null });
        return false;
      }
      onCreatedRef.current?.(result.entity);
      setState({ ...INITIAL_STATE, overrides: s.overrides, phase: 'awaitingPosition' });
      return true;
    },
    [currentLevelId],
  );

  const onCanvasClick = useCallback(
    (point: Readonly<Point2D>): boolean => {
      const s = stateRef.current;
      if (s.phase !== 'awaitingPosition') return false;
      return commitFromState(s, point);
    },
    [commitFromState],
  );

  // 3D placement bridge — same commit path as the 2D click (zero duplication).
  const onCanvasClickRef = useRef(onCanvasClick);
  onCanvasClickRef.current = onCanvasClick;
  useEffect(() => {
    return EventBus.on('bim:place-mep-radiator-3d', ({ point }) => {
      onCanvasClickRef.current(point);
    });
  }, []);

  const getStatusText = useCallback((): string => {
    const s = stateRef.current;
    if (s.phase === 'idle') return '';
    return s.phase === 'awaitingPosition' ? 'tools.mepRadiator.statusPosition' : '';
  }, []);

  const getGhostFootprint = useCallback(
    (cursorPos: Readonly<Point2D> | null): readonly Point3D[] | null => {
      const s = stateRef.current;
      if (s.phase !== 'awaitingPosition' || cursorPos === null) return null;
      const sceneUnits = getSceneUnitsRef.current?.() ?? 'mm';
      const params = buildDefaultMepRadiatorParams(cursorPos, s.overrides, sceneUnits);
      return computeMepRadiatorGeometry(params).footprint.vertices;
    },
    [],
  );

  // Publish handle to the ribbon/3D bridge (single-writer, mirror manifold).
  useEffect(() => {
    const isActive = state.phase !== 'idle';
    mepRadiatorToolBridgeStore.set({
      isActive,
      kind: 'panel-radiator',
      overrides: state.overrides,
      setParamOverrides,
      getSceneUnits: () => getSceneUnitsRef.current?.() ?? 'mm',
    });
    return () => {
      if (mepRadiatorToolBridgeStore.get()?.setParamOverrides === setParamOverrides) {
        mepRadiatorToolBridgeStore.set(null);
      }
    };
  }, [state, setParamOverrides]);

  return {
    state,
    activate,
    setParamOverrides,
    deactivate,
    reset,
    onCanvasClick,
    getStatusText,
    getGhostFootprint,
    isActive: state.phase !== 'idle',
    isAwaitingPosition: state.phase === 'awaitingPosition',
  };
}
