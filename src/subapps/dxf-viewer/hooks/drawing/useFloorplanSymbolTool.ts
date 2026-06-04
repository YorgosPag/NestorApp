/**
 * ADR-415 — Floorplan Symbol Tool React Hook Orchestrator.
 *
 * State machine:
 *   idle → awaitingPosition → committed → awaitingPosition (continuous)
 *
 * Single-click placement (Revit/ArchiCAD family placement): user picks the
 * floorplan-symbol tool → chooses WHICH symbol (catalog) + rotation from the
 * contextual ribbon tab → clicks to place → continuous chain. ESC resets.
 *
 * SSoT alignment:
 *   - Entity build via `buildFloorplanSymbolEntity` / `buildDefaultFloorplanSymbolParams`
 *     (`floorplan-symbol-completion.ts`). ZERO duplicate construction.
 *   - The ribbon picker reads/writes through `floorplanSymbolToolBridgeStore`
 *     (single writer = this hook's effect).
 *   - ADR-040 micro-leaf compliance: hook owns React state, no
 *     `useSyncExternalStore` against high-frequency stores. `getGhostFootprint`
 *     is a pure projection (no state mutation).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-415-2d-floorplan-symbol-library.md
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import {
  buildDefaultFloorplanSymbolParams,
  buildFloorplanSymbolEntity,
  type FloorplanSymbolParamOverrides,
  type SceneUnits,
} from './floorplan-symbol-completion';
import { computeFloorplanSymbolGeometry } from '../../bim/floorplan-symbols/floorplan-symbol-geometry';
import { DEFAULT_FLOORPLAN_SYMBOL_ASSET_ID } from '../../bim/floorplan-symbols/floorplan-symbol-catalog';
import type { FloorplanSymbolEntity } from '../../bim/types/floorplan-symbol-types';
import { floorplanSymbolToolBridgeStore } from '../../ui/ribbon/hooks/bridge/floorplan-symbol-tool-bridge-store';

// ─── State machine types ─────────────────────────────────────────────────────

export type FloorplanSymbolToolPhase = 'idle' | 'awaitingPosition' | 'committed';

export interface FloorplanSymbolToolState {
  readonly phase: FloorplanSymbolToolPhase;
  readonly assetId: string;
  readonly overrides: FloorplanSymbolParamOverrides;
  readonly error: string | null;
}

const INITIAL_STATE: FloorplanSymbolToolState = {
  phase: 'idle',
  assetId: DEFAULT_FLOORPLAN_SYMBOL_ASSET_ID,
  overrides: {},
  error: null,
};

// ─── Hook options + return ───────────────────────────────────────────────────

export interface UseFloorplanSymbolToolOptions {
  readonly onFloorplanSymbolCreated?: (entity: FloorplanSymbolEntity) => void;
  readonly currentLevelId?: string;
  readonly getSceneUnits?: () => SceneUnits;
}

export interface UseFloorplanSymbolToolResult {
  readonly state: FloorplanSymbolToolState;
  activate(): void;
  setAssetId(assetId: string): void;
  setParamOverrides(overrides: FloorplanSymbolParamOverrides): void;
  deactivate(): void;
  reset(): void;
  /** Returns true when the click committed a new floorplan symbol. */
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

export function useFloorplanSymbolTool(
  options: UseFloorplanSymbolToolOptions = {},
): UseFloorplanSymbolToolResult {
  const { onFloorplanSymbolCreated, currentLevelId = '0', getSceneUnits } = options;

  const [state, setState] = useState<FloorplanSymbolToolState>(INITIAL_STATE);
  const stateRef = useRef<FloorplanSymbolToolState>(state);
  stateRef.current = state;
  const getSceneUnitsRef = useRef(getSceneUnits);
  getSceneUnitsRef.current = getSceneUnits;
  const onCreatedRef = useRef(onFloorplanSymbolCreated);
  onCreatedRef.current = onFloorplanSymbolCreated;

  const activate = useCallback(() => {
    setState((prev) => ({ ...INITIAL_STATE, assetId: prev.assetId, overrides: prev.overrides, phase: 'awaitingPosition' }));
  }, []);

  const setAssetId = useCallback((assetId: string) => {
    setState((prev) => ({ ...prev, assetId, error: null }));
  }, []);

  const setParamOverrides = useCallback((overrides: FloorplanSymbolParamOverrides) => {
    setState((prev) => ({ ...prev, overrides: { ...prev.overrides, ...overrides } }));
  }, []);

  const deactivate = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const reset = useCallback(() => {
    setState((prev) => ({
      ...INITIAL_STATE,
      assetId: prev.assetId,
      overrides: prev.overrides,
      phase: prev.phase === 'idle' ? 'idle' : 'awaitingPosition',
    }));
  }, []);

  const commitFromState = useCallback(
    (s: FloorplanSymbolToolState, clickPoint: Readonly<Point2D>): boolean => {
      const overrides: FloorplanSymbolParamOverrides = { ...s.overrides, assetId: s.assetId };
      const sceneUnits = getSceneUnitsRef.current?.() ?? 'mm';
      const params = buildDefaultFloorplanSymbolParams(clickPoint, overrides, sceneUnits);
      const result = buildFloorplanSymbolEntity(params, currentLevelId);
      if (!result.ok) {
        setState({ ...s, error: result.hardErrors[0] ?? null });
        return false;
      }
      onCreatedRef.current?.(result.entity);
      setState({ ...INITIAL_STATE, assetId: s.assetId, overrides: s.overrides, phase: 'awaitingPosition' });
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

  const getStatusText = useCallback((): string => {
    const s = stateRef.current;
    if (s.phase === 'idle') return '';
    return s.phase === 'awaitingPosition' ? 'tools.floorplanSymbol.statusPosition' : '';
  }, []);

  const getGhostFootprint = useCallback(
    (cursorPos: Readonly<Point2D> | null): readonly Point3D[] | null => {
      const s = stateRef.current;
      if (s.phase !== 'awaitingPosition' || cursorPos === null) return null;
      const sceneUnits = getSceneUnitsRef.current?.() ?? 'mm';
      const params = buildDefaultFloorplanSymbolParams(cursorPos, { ...s.overrides, assetId: s.assetId }, sceneUnits);
      return computeFloorplanSymbolGeometry(params).footprint.vertices;
    },
    [],
  );

  // Publish handle to the ribbon picker (single-writer, mirror furniture).
  useEffect(() => {
    floorplanSymbolToolBridgeStore.set({
      isActive: state.phase !== 'idle',
      assetId: state.assetId,
      overrides: state.overrides,
      setAssetId,
      setParamOverrides,
    });
    return () => {
      if (floorplanSymbolToolBridgeStore.get()?.setAssetId === setAssetId) {
        floorplanSymbolToolBridgeStore.set(null);
      }
    };
  }, [state, setAssetId, setParamOverrides]);

  return {
    state,
    activate,
    setAssetId,
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
