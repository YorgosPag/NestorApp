/**
 * ADR-408 DHW — Domestic Hot Water Heater Tool React Hook Orchestrator.
 *
 * State machine:
 *   idle → awaitingPosition → committed → awaitingPosition (continuous)
 *
 * Single-click placement (Revit family placement): user picks the water heater tool →
 * clicks to place at the cursor point → continuous chain. ESC resets (handled
 * centrally by EscapeCommandBus, like the manifold/fixture/column tools).
 *
 * SSoT alignment:
 *   - Entity build via `buildMepWaterHeaterEntity` / `buildDefaultMepWaterHeaterParams`
 *     (`mep-water-heater-completion.ts`).
 *   - 3D placement bridge via `bim:place-mep-water-heater-3d` → same `onCanvasClick`.
 *   - ADR-040 micro-leaf compliance: hook owns React state, no
 *     `useSyncExternalStore` against high-frequency stores.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import {
  buildDefaultMepWaterHeaterParams,
  buildMepWaterHeaterEntity,
  type MepWaterHeaterParamOverrides,
  type SceneUnits,
} from './mep-water-heater-completion';
import { computeMepWaterHeaterGeometry } from '../../bim/mep-water-heaters/mep-water-heater-geometry';
import type { MepWaterHeaterEntity } from '../../bim/types/mep-water-heater-types';
import { mepWaterHeaterToolBridgeStore } from '../../ui/ribbon/hooks/bridge/mep-water-heater-tool-bridge-store';
import { EventBus } from '../../systems/events/EventBus';

// ─── State machine types ─────────────────────────────────────────────────────

export type MepWaterHeaterToolPhase = 'idle' | 'awaitingPosition' | 'committed';

export interface MepWaterHeaterToolState {
  readonly phase: MepWaterHeaterToolPhase;
  readonly overrides: MepWaterHeaterParamOverrides;
  readonly error: string | null;
}

const INITIAL_STATE: MepWaterHeaterToolState = {
  phase: 'idle',
  overrides: {},
  error: null,
};

// ─── Hook options + return ───────────────────────────────────────────────────

export interface UseMepWaterHeaterToolOptions {
  readonly onMepWaterHeaterCreated?: (entity: MepWaterHeaterEntity) => void;
  readonly currentLevelId?: string;
  readonly getSceneUnits?: () => SceneUnits;
}

export interface UseMepWaterHeaterToolResult {
  readonly state: MepWaterHeaterToolState;
  activate(): void;
  setParamOverrides(overrides: MepWaterHeaterParamOverrides): void;
  deactivate(): void;
  reset(): void;
  /** Returns true when the click committed a new water heater. */
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

export function useMepWaterHeaterTool(
  options: UseMepWaterHeaterToolOptions = {},
): UseMepWaterHeaterToolResult {
  const { onMepWaterHeaterCreated, currentLevelId = '0', getSceneUnits } = options;

  const [state, setState] = useState<MepWaterHeaterToolState>(INITIAL_STATE);
  const stateRef = useRef<MepWaterHeaterToolState>(state);
  stateRef.current = state;
  const getSceneUnitsRef = useRef(getSceneUnits);
  getSceneUnitsRef.current = getSceneUnits;
  const onCreatedRef = useRef(onMepWaterHeaterCreated);
  onCreatedRef.current = onMepWaterHeaterCreated;

  const activate = useCallback(() => {
    setState((prev) => ({ ...INITIAL_STATE, overrides: prev.overrides, phase: 'awaitingPosition' }));
  }, []);

  const setParamOverrides = useCallback((overrides: MepWaterHeaterParamOverrides) => {
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
    (s: MepWaterHeaterToolState, clickPoint: Readonly<Point2D>): boolean => {
      const sceneUnits = getSceneUnitsRef.current?.() ?? 'mm';
      const params = buildDefaultMepWaterHeaterParams(clickPoint, s.overrides, sceneUnits);
      const result = buildMepWaterHeaterEntity(params, currentLevelId);
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
    return EventBus.on('bim:place-mep-water-heater-3d', ({ point }) => {
      onCanvasClickRef.current(point);
    });
  }, []);

  const getStatusText = useCallback((): string => {
    const s = stateRef.current;
    if (s.phase === 'idle') return '';
    return s.phase === 'awaitingPosition' ? 'tools.mepWaterHeater.statusPosition' : '';
  }, []);

  const getGhostFootprint = useCallback(
    (cursorPos: Readonly<Point2D> | null): readonly Point3D[] | null => {
      const s = stateRef.current;
      if (s.phase !== 'awaitingPosition' || cursorPos === null) return null;
      const sceneUnits = getSceneUnitsRef.current?.() ?? 'mm';
      const params = buildDefaultMepWaterHeaterParams(cursorPos, s.overrides, sceneUnits);
      return computeMepWaterHeaterGeometry(params).footprint.vertices;
    },
    [],
  );

  // Publish handle to the ribbon/3D bridge (single-writer, mirror boiler).
  useEffect(() => {
    const isActive = state.phase !== 'idle';
    mepWaterHeaterToolBridgeStore.set({
      isActive,
      kind: 'electric-water-heater',
      overrides: state.overrides,
      setParamOverrides,
      getSceneUnits: () => getSceneUnitsRef.current?.() ?? 'mm',
    });
    return () => {
      if (mepWaterHeaterToolBridgeStore.get()?.setParamOverrides === setParamOverrides) {
        mepWaterHeaterToolBridgeStore.set(null);
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
